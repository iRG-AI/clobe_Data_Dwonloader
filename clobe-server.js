// ===== clobe.ai 재무 자동 업데이트 서버 =====
// 실행: node clobe-server.js  |  접속: http://localhost:3001

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const { spawn } = require('child_process');
const PORT = 3001;

// anaconda3 python3 사용 (xlwings 포함)
const PYTHON3 = '/Users/tycoonan/anaconda3/bin/python3';

const CFG_PATH = path.join(__dirname, 'clobe-config.json');
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8')); }
  catch(e) { return {}; }
}

const rateMap = new Map();
function checkRate(ip) {
  const now = Date.now();
  const e = rateMap.get(ip) || { count: 0, start: now };
  if (now - e.start > 60000) { rateMap.set(ip, { count: 1, start: now }); return true; }
  if (e.count >= 60) return false;
  e.count++; rateMap.set(ip, e);
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of rateMap) if (now - e.start > 120000) rateMap.delete(ip);
}, 60000);

const CORS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': 'http://localhost:3001',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

let runningProc = null;
let currentLogFile = null;
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function sendTelegram(cfg, message) {
  if (!cfg.telegram?.enabled || !cfg.telegram?.botToken || !cfg.telegram?.chatId) return;
  const text = encodeURIComponent(message);
  const p = `/bot${cfg.telegram.botToken}/sendMessage?chat_id=${cfg.telegram.chatId}&text=${text}`;
  https.get({ hostname: 'api.telegram.org', path: p }, () => {}).on('error', () => {});
}


const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const ip  = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if (!checkRate(ip)) { res.writeHead(429, CORS); res.end('{}'); return; }
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }

  // HTML 서빙
  if (url.pathname === '/' || url.pathname === '/index.html') {
    fs.readFile(path.join(__dirname, 'clobe-index.html'), (err, data) => {
      if (err) { res.writeHead(404); res.end('Not Found'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(data);
    });
    return;
  }

  // 상태 조회
  if (url.pathname === '/status' && req.method === 'GET') {
    res.writeHead(200, CORS);
    res.end(JSON.stringify({ running: runningProc !== null }));
    return;
  }

  // 실행
  if (url.pathname === '/run' && req.method === 'POST') {
    if (runningProc) { res.writeHead(409, CORS); res.end(JSON.stringify({ error: '이미 실행 중' })); return; }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      let params = {};
      try { params = JSON.parse(body); } catch(e) {}
      const year = (params.year || new Date().getFullYear()).toString();
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      currentLogFile = path.join(LOG_DIR, `run_${ts}.log`);
      const logStream = fs.createWriteStream(currentLogFile, { flags: 'a' });
      function writeLog(line) {
        const t = new Date().toLocaleTimeString('ko-KR');
        logStream.write(`[${t}] ${line}\n`);
      }
      writeLog(`▶ clobe 업데이트 시작 (${year}년)`);
      const cfg = loadConfig();
      const env = { ...process.env, CLOBE_YEAR: year };
      runningProc = spawn(PYTHON3, [path.join(__dirname, 'clobe_update.py')], { cwd: __dirname, env });
      runningProc.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => writeLog(l)));
      runningProc.stderr.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => writeLog('[ERR] ' + l)));
      runningProc.on('close', code => {
        writeLog(code === 0 ? '완료!' : '오류 코드: ' + code);
        logStream.end(); runningProc = null;
        sendTelegram(cfg, code === 0 ? `clobe 완료 (${year}년)` : `clobe 실패 (${year}년) 코드: ${code}`);
      });
      runningProc.on('error', err => { writeLog('SYS: ' + err.message); logStream.end(); runningProc = null; });
      res.writeHead(200, CORS);
      res.end(JSON.stringify({ ok: true, logFile: path.basename(currentLogFile) }));
    });
    return;
  }


  // 중지
  if (url.pathname === '/stop' && req.method === 'POST') {
    if (runningProc) { runningProc.kill('SIGTERM'); runningProc = null; }
    res.writeHead(200, CORS); res.end(JSON.stringify({ ok: true }));
    return;
  }

  // 로그 SSE 스트리밍
  if (url.pathname === '/logs/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': 'http://localhost:3001',
      'Connection': 'keep-alive',
    });
    const noLog = JSON.stringify({ type: 'info', msg: '로그 없음' });
    if (!currentLogFile || !fs.existsSync(currentLogFile)) {
      res.write('data: ' + noLog + '\n\n');
      res.end();
      return;
    }
    const content = fs.readFileSync(currentLogFile, 'utf8');
    content.split('\n').filter(Boolean).forEach(line => {
      res.write('data: ' + JSON.stringify({ type: 'log', msg: line }) + '\n\n');
    });
    let size = fs.statSync(currentLogFile).size;
    const interval = setInterval(() => {
      if (!fs.existsSync(currentLogFile)) { clearInterval(interval); res.end(); return; }
      const newSize = fs.statSync(currentLogFile).size;
      if (newSize > size) {
        const fd = fs.openSync(currentLogFile, 'r');
        const buf = Buffer.alloc(newSize - size);
        fs.readSync(fd, buf, 0, buf.length, size);
        fs.closeSync(fd);
        buf.toString('utf8').split('\n').filter(Boolean).forEach(line => {
          res.write('data: ' + JSON.stringify({ type: 'log', msg: line }) + '\n\n');
        });
        size = newSize;
      }
      if (!runningProc) {
        res.write('data: ' + JSON.stringify({ type: 'done' }) + '\n\n');
        clearInterval(interval); res.end();
      }
    }, 500);
    req.on('close', () => clearInterval(interval));
    return;
  }


  // 로그 목록
  if (url.pathname === '/logs' && req.method === 'GET') {
    const files = fs.existsSync(LOG_DIR)
      ? fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.log')).sort().reverse().slice(0, 20)
      : [];
    res.writeHead(200, CORS); res.end(JSON.stringify(files));
    return;
  }

  // 특정 로그 파일
  if (url.pathname.startsWith('/logs/') && req.method === 'GET') {
    const fname = path.basename(url.pathname.replace('/logs/', ''));
    const fpath = path.join(LOG_DIR, fname);
    if (!fs.existsSync(fpath) || !fname.endsWith('.log')) {
      res.writeHead(404, CORS); res.end('{}'); return;
    }
    res.writeHead(200, { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(fs.readFileSync(fpath, 'utf8'));
    return;
  }

  // 설정 읽기 (비밀번호 마스킹)
  if (url.pathname === '/config' && req.method === 'GET') {
    const cfg  = loadConfig();
    const safe = JSON.parse(JSON.stringify(cfg));
    if (safe.clobe?.password) safe.clobe.password = '***';
    res.writeHead(200, CORS); res.end(JSON.stringify(safe));
    return;
  }

  res.writeHead(404, CORS); res.end('{}');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('========================================');
  console.log('  clobe.ai 재무 업데이트 서버');
  console.log('========================================');
  console.log('  브라우저: http://localhost:' + PORT);
  console.log('  종료: Ctrl+C');
  console.log('========================================');
  console.log('');
});

// 스케줄러 모드 (launchd 자동 실행)
if (process.argv.includes('--scheduler')) {
  const cfg  = loadConfig();
  const year = new Date().getFullYear().toString();
  const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const logFile   = path.join(LOG_DIR, 'scheduler_' + ts + '.log');
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  const slog = msg => {
    const t = new Date().toLocaleTimeString('ko-KR');
    const line = '[' + t + '] ' + msg;
    console.log(line); logStream.write(line + '\n');
  };
  slog('스케줄러 자동 실행 (' + year + '년)');
  const env  = { ...process.env, CLOBE_YEAR: year };
  const proc = spawn(PYTHON3, [path.join(__dirname, 'clobe_update.py')], { cwd: __dirname, env });
  proc.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => slog(l)));
  proc.stderr.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => slog('[ERR] ' + l)));
  proc.on('close', code => {
    slog(code === 0 ? '완료!' : '오류: ' + code);
    logStream.end();
    sendTelegram(cfg, code === 0
      ? 'clobe 완료 (' + year + '년) ' + new Date().toLocaleString('ko-KR')
      : 'clobe 실패 (' + year + '년) 코드: ' + code);
    process.exit(code);
  });
  proc.on('error', err => { slog('SYS: ' + err.message); process.exit(1); });
}
