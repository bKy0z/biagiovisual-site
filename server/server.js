/**
 * BIAGIOVISUALS — Backend Server
 */
'use strict';
require('dotenv').config();
const express      = require('express');
const helmet       = require('helmet');
const rateLimit    = require('express-rate-limit');
const multer       = require('multer');
const cookieParser = require('cookie-parser');
const crypto       = require('crypto');
const path         = require('path');
const fs           = require('fs');
const { v4: uuidv4 } = require('uuid');

/* ── Env validation ── */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const SESSION_TTL_MS = (parseInt(process.env.SESSION_TTL_MINUTES,10)||120)*60*1000;
const PORT           = parseInt(process.env.PORT,10)||3000;
const IS_PROD        = process.env.NODE_ENV==='production';

if (!ADMIN_PASSWORD||ADMIN_PASSWORD==='cambia_questa_password_ora'){
  console.error('[BV] ADMIN_PASSWORD non impostata. Crea il file .env');process.exit(1);}
if (!SESSION_SECRET||SESSION_SECRET.length<32){
  console.error('[BV] SESSION_SECRET troppo corta (min 32 char)');process.exit(1);}

/* ── Password hashing (constant-time) ── */
const PWD_SALT = crypto.createHash('sha256').update(SESSION_SECRET+'bv_salt_v1').digest('hex').slice(0,16);
const PWD_HASH = crypto.createHmac('sha256',SESSION_SECRET).update(ADMIN_PASSWORD+PWD_SALT).digest('hex');
function verifyPassword(input){
  const h=crypto.createHmac('sha256',SESSION_SECRET).update(input+PWD_SALT).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(h),Buffer.from(PWD_HASH));
}

/* ── Sessions in-memory ── */
const sessions=new Map();
function createSession(ip){
  const token=uuidv4()+'-'+uuidv4();
  sessions.set(token,{createdAt:Date.now(),expiresAt:Date.now()+SESSION_TTL_MS,ip});
  return token;
}
function validateSession(token){
  if(!token||!sessions.has(token))return false;
  const s=sessions.get(token);
  if(Date.now()>s.expiresAt){sessions.delete(token);return false;}
  return true;
}
function destroySession(token){sessions.delete(token);}
setInterval(()=>{const now=Date.now();for(const[t,s]of sessions)if(now>s.expiresAt)sessions.delete(t);},15*60*1000);

/* ── Directories ── */
const UPLOADS_DIR=path.join(__dirname,'uploads');
const DATA_DIR=path.join(__dirname,'data');
const DATA_FILE=path.join(DATA_DIR,'photos.json');
[UPLOADS_DIR,DATA_DIR].forEach(d=>{if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});});
if(!fs.existsSync(DATA_FILE))fs.writeFileSync(DATA_FILE,JSON.stringify({photos:[]},null,2));

function readDB(){try{return JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));}catch{return{photos:[]};}}
function writeDB(data){fs.writeFileSync(DATA_FILE,JSON.stringify(data,null,2));}

/* ── Multer ── */
const storage=multer.diskStorage({
  destination:(_,__,cb)=>cb(null,UPLOADS_DIR),
  filename:(_,file,cb)=>{
    const ext=path.extname(file.originalname).toLowerCase();
    const safe=['.jpg','.jpeg','.png','.webp','.gif'].includes(ext)?ext:'.jpg';
    cb(null,uuidv4()+safe);
  }
});
const upload=multer({storage,limits:{fileSize:25*1024*1024},fileFilter:(_,file,cb)=>{
  cb(null,['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype));
}});

/* ── Express app ── */
const app=express();
app.use(helmet({
  contentSecurityPolicy:{directives:{
    defaultSrc:["'self'"],
    scriptSrc:["'self'","'unsafe-inline'","https://fonts.googleapis.com"],
    styleSrc:["'self'","'unsafe-inline'","https://fonts.googleapis.com","https://fonts.gstatic.com"],
    fontSrc:["'self'","https://fonts.gstatic.com","https://fonts.googleapis.com"],
    imgSrc:["'self'","data:","blob:"],connectSrc:["'self'"],frameSrc:["'none'"],objectSrc:["'none'"],
  }},crossOriginEmbedderPolicy:false,
}));
app.use(express.json({limit:'1mb'}));
app.use(cookieParser());
app.use(rateLimit({windowMs:15*60*1000,max:500,standardHeaders:true,legacyHeaders:false}));

const loginLimiter=rateLimit({
  windowMs:15*60*1000,max:10,skipSuccessfulRequests:true,
  handler:(_,res)=>res.status(429).json({authenticated:false,error:'Troppi tentativi. Riprova tra 15 minuti.'}),
});

function requireAuth(req,res,next){
  if(!validateSession(req.cookies?.bv_admin_token))
    return res.status(401).json({error:'Non autorizzato.'});
  next();
}

/* ── API Routes ── */
app.post('/api/admin/login',loginLimiter,(req,res)=>{
  const{password}=req.body;
  if(!password||typeof password!=='string')
    return res.status(400).json({authenticated:false,error:'Password mancante.'});
  if(!verifyPassword(password)){
    console.warn(`[BV] Login fallito da ${req.ip}`);
    return res.status(401).json({authenticated:false,error:'Password errata.'});
  }
  const token=createSession(req.ip);
  res.cookie('bv_admin_token',token,{httpOnly:true,secure:IS_PROD,sameSite:'strict',maxAge:SESSION_TTL_MS});
  console.log(`[BV] Login admin OK da ${req.ip}`);
  res.json({authenticated:true,expiresIn:SESSION_TTL_MS/1000});
});

app.post('/api/admin/logout',(req,res)=>{
  const token=req.cookies?.bv_admin_token;
  if(token)destroySession(token);
  res.clearCookie('bv_admin_token');
  res.json({success:true});
});

app.get('/api/admin/check',(req,res)=>{
  const token=req.cookies?.bv_admin_token;
  if(!validateSession(token))return res.json({authenticated:false});
  res.json({authenticated:true,expiresAt:sessions.get(token).expiresAt});
});

app.get('/api/photos',(_,res)=>{
  res.json({photos:readDB().photos});
});

app.post('/api/photos',requireAuth,upload.single('image'),(req,res)=>{
  if(!req.file)return res.status(400).json({error:'Nessun file o formato non supportato.'});
  const{title='Senza titolo',category}=req.body;
  if(!['eventi','ritratti','social'].includes(category)){
    fs.unlink(req.file.path,()=>{});
    return res.status(400).json({error:'Categoria non valida.'});
  }
  const db=readDB();
  const photo={id:uuidv4(),filename:req.file.filename,url:`/uploads/${req.file.filename}`,
    title:title.slice(0,100),category,date:new Date().toISOString(),size:req.file.size};
  db.photos.unshift(photo);
  writeDB(db);
  console.log(`[BV] Foto caricata: ${photo.filename} (${category})`);
  res.status(201).json({success:true,photo});
});

app.delete('/api/photos/:id',requireAuth,(req,res)=>{
  const db=readDB();
  const idx=db.photos.findIndex(p=>p.id===req.params.id);
  if(idx===-1)return res.status(404).json({error:'Foto non trovata.'});
  const[photo]=db.photos.splice(idx,1);
  writeDB(db);
  fs.unlink(path.join(UPLOADS_DIR,photo.filename),()=>{});
  console.log(`[BV] Foto eliminata: ${photo.filename}`);
  res.json({success:true});
});

app.put('/api/photos/:id',requireAuth,(req,res)=>{
  const{title,category}=req.body;
  if(category&&!['eventi','ritratti','social'].includes(category))
    return res.status(400).json({error:'Categoria non valida.'});
  const db=readDB();
  const idx=db.photos.findIndex(p=>p.id===req.params.id);
  if(idx===-1)return res.status(404).json({error:'Foto non trovata.'});
  if(category)db.photos[idx].category=category;
  if(title)db.photos[idx].title=title.slice(0,100);
  db.photos[idx].updatedAt=new Date().toISOString();
  writeDB(db);
  res.json({success:true,photo:db.photos[idx]});
});

/* ── Blocca accesso a file riservati ── */
app.get(['/server.js','/.env','/data/*','/node_modules/*'],(_,res)=>res.status(403).end());

/* ── Static files ── */
app.use('/uploads',express.static(UPLOADS_DIR,{maxAge:IS_PROD?'7d':0,etag:true}));
app.use(express.static(path.join(__dirname),{index:'index.html'}));
app.use((_,res)=>res.status(404).sendFile(path.join(__dirname,'index.html')));
app.use((err,_,res,__)=>{console.error('[BV]',err);res.status(500).json({error:'Errore server.'});});

app.listen(PORT,()=>{
  console.log(`[BV] Server avviato → http://localhost:${PORT}  (${IS_PROD?'PROD':'DEV'}, TTL ${SESSION_TTL_MS/60000}min)`);
});

module.exports=app;