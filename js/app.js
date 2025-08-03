import { Chessboard } from 'https://cdn.jsdelivr.net/npm/cm-chessboard@8.7.1/src/Chessboard.js';

/* ===== ドロワー開閉ロジック ===== */
const body = document.body;
const toggle = document.getElementById('toggleSidebar');
toggle.addEventListener('click', () => {
  body.classList.toggle('drawer-closed');
});

/* ===== 定数 & 状態 ===== */
const TIME_LIMIT = 180; // 秒 (3分)
let problems = [], startTime = 0, timerId;
let idx = 0;
const savedIdx = localStorage.getItem('lastOpened');
if (savedIdx !== null) {
  const n = parseInt(savedIdx, 10);
  if (!isNaN(n)) idx = n;
}
const solved = new Set(JSON.parse(localStorage.getItem('solved') || '[]'));
const hard = new Set(JSON.parse(localStorage.getItem('hard') || '[]'));
const openGroups = new Set();

/* ===== DOM 要素 ===== */
const $ = s => document.querySelector(s);
const list = $('#list'),
      title = $('#title'),
      lichess = $('#lichess'),
      solvedBtn = $('#solvedBtn'),
      bar = $('#bar'),
      pTxt = $('#pTxt'),
      timer = $('#timer'),
      hardBtn = $('#hardBtn'),
      randHard = $('#randHard')
      // exportBtn = $('#exportBtn'),
      // importBtn = $('#importBtn'),
      // importFile = $('#importFile');

/* ===== ボード初期化 ===== */
const board = new Chessboard($('#board'), {
  assetsUrl: 'https://cdn.jsdelivr.net/npm/cm-chessboard@8.7.1/assets/',
  style: { moveInputMode: 'none' }
});

/* ===== ヘルパー ===== */
const fenURL = f => `https://lichess.org/analysis/${f.replace(/ /g, '_')}`;
function gKey(t) {
  const s = t.toLowerCase();
  const m = s.match(/mate in (\d+)/);
  if (m) return `Mate in ${m[1]}`;
  const w = s.match(/mate in (one|two|three|four|five)/);
  if (w) {
    const map = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    return `Mate in ${map[w[1]]}`;
  }
  return 'Others';
}
const gSort = (a, b) =>
  (parseInt(a.match(/\d+/)) || 99) - (parseInt(b.match(/\d+/)) || 99);
function updBar() {
  pTxt.textContent = `${solved.size}/${problems.length} solved`;
  bar.style.width = `${(problems.length > 0 ? solved.size / problems.length * 100 : 0)}%`;
}

/* ===== タイマー ===== */
function startTimer() {
  clearInterval(timerId);
  startTime = Date.now();
  tick();
  timerId = setInterval(tick, 1000);
}
function tick() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const remain = Math.max(0, TIME_LIMIT - elapsed);
  const m = String(Math.floor(remain / 60)).padStart(2, '0');
  const s = String(remain % 60).padStart(2, '0');
  timer.textContent = `${m}:${s}`;
  if (remain === 0) clearInterval(timerId);
}

/* ===== リスト描画 ===== */
function render(filter = '') {
  list.innerHTML = '';
  const grp = {};
  problems.forEach(p => (grp[gKey(p.type)] ??= []).push(p));
  Object.keys(grp).sort(gSort).forEach(g => {
    const arr = grp[g],
          done = arr.filter(p => solved.has(p.problemid)).length;
    const li = document.createElement('li');
    li.className = 'groupItem ' + (openGroups.has(g) ? 'open' : 'closed');
    li.innerHTML = `
      <button class="groupBtn">
        <span>${g}</span>
        <span class="count">${done}/${arr.length}
          <span class="arrow">▶</span>
        </span>
      </button>
    `;
    li.querySelector('.groupBtn').onclick = () => {
      if (openGroups.has(g)) openGroups.delete(g);
      else openGroups.add(g);
      li.classList.toggle('open');
      li.classList.toggle('closed');
    };
    const ul = document.createElement('ul');
    ul.className = 'subList';
    arr.forEach(p => {
      if (filter &&
         !`${p.problemid}`.includes(filter) &&
         !p.type.toLowerCase().includes(filter)) return;
      const sub = document.createElement('li');
      const cls = [
        'link',
        solved.has(p.problemid) ? 'solved' : '',
        hard.has(p.problemid) ? 'hardMark' : ''
      ].join(' ');
      sub.innerHTML = `<a class="${cls}" data-id="${p.problemid}" href="#">#${p.problemid}</a>`;
      sub.firstElementChild.onclick = e => {
        e.preventDefault();
        idx = problems.indexOf(p);
        load();
      };
      ul.appendChild(sub);
    });
    li.appendChild(ul);
    list.appendChild(li);
  });
  highlight();
}
function highlight() {
  list.querySelectorAll('.link').forEach(a => a.classList.remove('current'));
  const cur = list.querySelector(`.link[data-id="${problems[idx]?.problemid}"]`);
  cur?.classList.add('current');
  cur?.scrollIntoView({ block: 'nearest' });
}

/* ===== 問題読み込み ===== */
function load() {
  const p = problems[idx];
  const active = p.fen.split(' ')[1] === 'w'
    ? 'White to move'
    : 'Black to move';
  title.textContent = `#${p.problemid} – ${p.type} (${active})`;
  board.setPosition(p.fen, true);
  lichess.href = fenURL(p.fen);
  solvedBtn.disabled = false;
  hardBtn.disabled = false;
  solvedBtn.textContent = solved.has(p.problemid)
    ? '✅'
    : '✅';
  hardBtn.textContent = hard.has(p.problemid)
    ? '💪'
    : '💪';
  randHard.disabled = hard.size === 0;
  openGroups.add(gKey(p.type));
  render($('#filter').value.toLowerCase());
  updBar();
  startTimer();
  localStorage.setItem('lastOpened', idx);
}

/* ===== イベントハンドラ ===== */
/* solved */
solvedBtn.onclick = () => {
  const id = problems[idx].problemid;
  solved.add(id);
  localStorage.setItem('solved', JSON.stringify([...solved]));
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  if (elapsed > TIME_LIMIT) {
    hard.add(id);
    localStorage.setItem('hard', JSON.stringify([...hard]));
  }
  idx = (idx + 1) % problems.length;
  load();
};
/* hard toggle */
hardBtn.onclick = () => {
  const id = problems[idx].problemid;
  if (hard.has(id)) hard.delete(id);
  else hard.add(id);
  localStorage.setItem('hard', JSON.stringify([...hard]));
  hardBtn.textContent = hard.has(id)
    ? '💪'
    : '💪';
  randHard.disabled = hard.size === 0;
  render($('#filter').value.toLowerCase());
};
/* nav */
$('#prev').onclick = () => { idx = (idx - 1 + problems.length) % problems.length; load(); };
$('#next').onclick = () => { idx = (idx + 1) % problems.length; load(); };
$('#randAll').onclick = () => { idx = Math.floor(Math.random() * problems.length); load(); };
$('#randGrp').onclick = () => {
  const same = problems.filter(p => gKey(p.type) === gKey(problems[idx].type));
  idx = problems.indexOf(same[Math.floor(Math.random() * same.length)]);
  load();
};
randHard.onclick = () => {
  const hardProblems = problems.filter(p => hard.has(p.problemid));
  if (hardProblems.length === 0) return;
  idx = problems.indexOf(hardProblems[Math.floor(Math.random() * hardProblems.length)]);
  load();
};
/* filter */
$('#filter').oninput = e => render(e.target.value.toLowerCase());
/* keyboard */
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  switch (e.key) {
    case 'ArrowLeft': $('#prev').click(); break;
    case 'ArrowRight': $('#next').click(); break;
    case 'r': case 'R': $('#randAll').click(); break;
    case 'g': case 'G': $('#randGrp').click(); break;
    case 'h': case 'H':
      if (!hardBtn.disabled) { e.preventDefault(); hardBtn.click(); }
      break;
    case 'd': case 'D':
      if (!randHard.disabled) { e.preventDefault(); randHard.click(); }
      break;
    case 's': case 'S': case 'Enter':
      if (!solvedBtn.disabled) {
        e.preventDefault();
        solvedBtn.click();
      }
      break;
  }
});
// /* Export */
// exportBtn.onclick = () => {
//   const state = { solved: [...solved], hard: [...hard], lastOpened: idx };
//   const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
//   const url = URL.createObjectURL(blob);
//   const a = document.createElement('a');
//   a.href = url;
//   a.download = 'chess-tactics-state.json';
//   a.click();
//   URL.revokeObjectURL(url);
// };
// /* Import */
// importBtn.onclick = () => importFile.click();
// importFile.onchange = e => {
//   const file = e.target.files[0];
//   if (!file) return;
//   const reader = new FileReader();
//   reader.onload = ev => {
//     try {
//       const obj = JSON.parse(ev.target.result);
//       if (!Array.isArray(obj.solved) || !Array.isArray(obj.hard)) {
//         throw new Error('Invalid format');
//       }
//       solved.clear(); obj.solved.forEach(id => solved.add(id));
//       hard.clear();   obj.hard.forEach(id => hard.add(id));
//       localStorage.setItem('solved', JSON.stringify([...solved]));
//       localStorage.setItem('hard',   JSON.stringify([...hard]));
//       if (typeof obj.lastOpened === 'number') {
//         idx = obj.lastOpened;
//         localStorage.setItem('lastOpened', idx);
//       }
//       load();
//       alert('Import successful!');
//     } catch (err) {
//       console.error(err);
//       alert('Failed to import: ' + err.message);
//     }
//     importFile.value = '';
//   };
//   reader.readAsText(file);
// };
/* fetch problems */
(async () => {
  problems = (await fetch('problems.json').then(r => r.json())).problems;
  load();
})();
