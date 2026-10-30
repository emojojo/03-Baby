// ============================================================================
// 糖果宝宝 (CandyBaby) · 新生儿全能成长与健康看板核心逻辑
// ============================================================================

const STORAGE_KEY = 'candy_baby_tracker_v1';
const CLOUD_CFG_KEY = 'candy_baby_cloud_cfg_v1';

// 全局状态
let appState = {
  isDemo: true,
  updatedAt: Date.now(),
  deletedIds: [],
  profile: {
    name: '小糖果',
    gender: 'girl',
    birthDateTime: '', // 动态初始化为7天前
    birthWeight: 3.25,
    birthLength: 50.0,
    feedIntervalHours: 3.0,
    milkFactor: 150
  },
  records: [],
  dailyChecklist: {} // { 'YYYY-MM-DD': { vd3: true, cord: true, ... } }
};

let currentChartDays = 7;
let currentLogFilter = 'all';
let currentModalCategory = 'feed';

// 实时计时器状态
let liveTimer = {
  running: false,
  mode: null, // 'left' | 'right' | 'sleep'
  seconds: 0,
  leftSeconds: 0,
  rightSeconds: 0,
  intervalId: null
};

// 必做护理清单定义
const CARE_CHECKLIST_ITEMS = [
  { id: 'vd3', icon: '☀️', label: '喂维生素 D3 (400IU)', recordTitle: '☀️ 补充维生素 D3 (400IU)' },
  { id: 'vad', icon: '💧', label: '喂维生素 AD (1粒)', recordTitle: '💧 补充维生素 AD (1粒)' },
  { id: 'vk1', icon: '🩸', label: '喂维生素 K1 (预防出血)', recordTitle: '🩸 补充维生素 K1 (滴剂/口服)' },
  { id: 'jaundice_am', icon: '🌞', label: '早晚黄疸测量' },
  { id: 'cord', icon: '🌿', label: '肚脐碘伏消毒护理', recordTitle: '🌿 肚脐碘伏消毒护理' },
  { id: 'bath', icon: '🛁', label: '温水洗澡 & 婴儿抚触', recordTitle: '🛁 温水洗澡 + 抚触按摩' },
  { id: 'butt', icon: '🍑', label: '晾屁屁 / 涂护臀膏' },
  { id: 'tummy', icon: '🐣', label: '抬头 / 趴趴练习' }
];

// 工具函数：日期格式化
function pad2(n) {
  return String(n).padStart(2, '0');
}

function toLocalDateStr(dateObj) {
  const d = new Date(dateObj);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toDateTimeLocalStr(dateObj) {
  const d = new Date(dateObj);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatTimeHM(isoStr) {
  const d = new Date(isoStr);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatShortDate(dateStr) {
  const parts = dateStr.split('-');
  return `${ Number(parts[1]) }/${ Number(parts[2]) }`;
}

function uid() {
  return 'rec_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

// ============================================================================
// 1. 生成逼真的 7 天新生儿示例数据
// ============================================================================
function generateDemoData() {
  const now = new Date();
  const birthDate = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
  birthDate.setHours(8, 30, 0, 0);

  const profile = {
    name: '小糖果',
    gender: 'girl',
    birthDateTime: toDateTimeLocalStr(birthDate),
    birthWeight: 3.25,
    birthLength: 50.0,
    feedIntervalHours: 3.0,
    milkFactor: 150
  };

  const records = [];
  const dailyChecklist = {};

  // 新生儿第 1~7 天生理特征曲线模拟
  const dailyConfigs = [
    { dayOffset: -6, formulaMl: 30, feeds: 7, forehead: 5.8, chest: 5.4, weight: 3.25, temp: 36.7, poopColor: '墨绿胎便', poopTex: '黏稠胎便' },
    { dayOffset: -5, formulaMl: 40, feeds: 8, forehead: 8.6, chest: 8.2, weight: 3.14, temp: 36.8, poopColor: '墨绿胎便', poopTex: '黏稠胎便' },
    { dayOffset: -4, formulaMl: 50, feeds: 8, forehead: 11.4, chest: 10.8, weight: 3.10, temp: 36.8, poopColor: '黄绿色', poopTex: '糊状' },
    { dayOffset: -3, formulaMl: 55, feeds: 8, forehead: 13.2, chest: 12.6, weight: 3.16, temp: 36.9, poopColor: '黄绿色', poopTex: '糊状' },
    { dayOffset: -2, formulaMl: 65, feeds: 8, forehead: 12.1, chest: 11.5, weight: 3.24, temp: 36.7, poopColor: '金黄色', poopTex: '糊状' },
    { dayOffset: -1, formulaMl: 70, feeds: 8, forehead: 10.4, chest: 9.8, weight: 3.33, temp: 36.8, poopColor: '金黄色', poopTex: '糊状' },
    { dayOffset: 0,  formulaMl: 75, feeds: 6, forehead: 8.9, chest: 8.3, weight: 3.42, temp: 36.8, poopColor: '金黄色', poopTex: '糊状' }
  ];

  const feedHours = [1, 4, 7, 10, 13, 16, 19, 22];
  const diaperHours = [2, 5, 8, 11, 14, 17, 20, 23];
  const sleepHours = [2.5, 6, 9.5, 13.5, 17, 21];

  dailyConfigs.forEach((cfg) => {
    const baseDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + cfg.dayOffset);
    const dateKey = toLocalDateStr(baseDay);

    dailyChecklist[dateKey] = {
      vd3: true,
      vad: cfg.dayOffset % 2 === 0,
      vk1: cfg.dayOffset === -6 || cfg.dayOffset === 0,
      jaundice_am: true,
      cord: true,
      bath: cfg.dayOffset !== -5,
      butt: true,
      tummy: cfg.dayOffset >= -2
    };

    // 喂奶记录
    feedHours.forEach((hr, idx) => {
      const t = new Date(baseDay);
      t.setHours(hr, (idx * 7) % 30, 0, 0);
      if (t.getTime() > now.getTime() - 25 * 60 * 1000) return; // 不超过当前时间

      const isBreastBottle = idx % 3 === 1;
      const isNursing = idx % 4 === 2;
      const ml = isNursing ? 0 : cfg.formulaMl + ((idx % 3) - 1) * 5;

      records.push({
        id: uid() + '_' + cfg.dayOffset + '_f' + idx,
        category: 'feed',
        timestamp: toDateTimeLocalStr(t),
        feedType: isNursing ? 'nursing' : (isBreastBottle ? 'breast_bottle' : 'formula'),
        amountMl: isNursing ? 0 : ml,
        leftMin: isNursing ? 12 : 0,
        rightMin: isNursing ? 10 : 0,
        burped: '已拍嗝',
        spitUp: '无溢奶',
        note: isNursing ? '双侧亲喂顺畅' : '吃奶很有力，拍出大嗝'
      });
    });

    // 换尿布记录
    diaperHours.forEach((hr, idx) => {
      const t = new Date(baseDay);
      t.setHours(hr, 15, 0, 0);
      if (t.getTime() > now.getTime() - 50 * 60 * 1000) return;

      const subType = idx % 3 === 0 ? 'both' : (idx % 4 === 1 ? 'dirty' : 'wet');
      records.push({
        id: uid() + '_' + cfg.dayOffset + '_d' + idx,
        category: 'diaper',
        timestamp: toDateTimeLocalStr(t),
        diaperType: subType,
        amountLevel: '适中',
        poopColor: subType === 'wet' ? '' : cfg.poopColor,
        poopTexture: subType === 'wet' ? '' : cfg.poopTex,
        rashStatus: '小屁屁正常',
        note: subType === 'wet' ? '尿量充足，颜色清亮' : `便便呈${cfg.poopColor}，${cfg.poopTex}`
      });
    });

    // 黄疸记录（每天早晚各一次）
    [9, 18].forEach((hr, idx) => {
      const t = new Date(baseDay);
      t.setHours(hr, 20, 0, 0);
      if (t.getTime() > now.getTime()) return;

      const fh = +(cfg.forehead + (idx === 1 ? 0.3 : 0)).toFixed(1);
      const ch = +(cfg.chest + (idx === 1 ? 0.2 : 0)).toFixed(1);
      const avg = +((fh + ch) / 2).toFixed(1);

      records.push({
        id: uid() + '_' + cfg.dayOffset + '_j' + idx,
        category: 'jaundice',
        timestamp: toDateTimeLocalStr(t),
        forehead: fh,
        chest: ch,
        cheek: +(avg - 0.2).toFixed(1),
        valueMgDl: avg,
        measureMethod: '经皮黄疸仪(TcB)',
        therapyStatus: avg > 12.5 ? '晒太阳+多吃多排' : '居家观察',
        note: idx === 0 ? '晨间自然光下测量' : '傍晚复测黄疸'
      });
    });

    // 睡眠记录
    sleepHours.forEach((hr, idx) => {
      const t = new Date(baseDay);
      t.setHours(Math.floor(hr), (hr % 1) * 60, 0, 0);
      if (t.getTime() > now.getTime() - 90 * 60 * 1000) return;

      const durMin = 120 + (idx % 3) * 25;
      records.push({
        id: uid() + '_' + cfg.dayOffset + '_s' + idx,
        category: 'sleep',
        timestamp: toDateTimeLocalStr(t),
        durationMin: durMin,
        sootheMethod: idx % 2 === 0 ? '奶睡' : '自主入睡',
        sleepQuality: '安稳香甜',
        note: `睡了 ${(durMin / 60).toFixed(1)} 小时`
      });
    });

    // 体重与体温记录
    const gt = new Date(baseDay);
    gt.setHours(10, 0, 0, 0);
    if (gt.getTime() <= now.getTime()) {
      records.push({
        id: uid() + '_' + cfg.dayOffset + '_g',
        category: 'growth',
        timestamp: toDateTimeLocalStr(gt),
        weightKg: cfg.weight,
        lengthCm: +(50.0 + (cfg.dayOffset + 6) * 0.15).toFixed(1),
        headCm: 34.2,
        tempC: cfg.temp,
        note: '上午洗澡后裸重测量'
      });
    }

    // 每日维生素D3与脐带护理记录
    const ct = new Date(baseDay);
    ct.setHours(10, 30, 0, 0);
    if (ct.getTime() <= now.getTime()) {
      records.push({
        id: uid() + '_' + cfg.dayOffset + '_c',
        category: 'care',
        timestamp: toDateTimeLocalStr(ct),
        careItem: '☀️ 维生素D3 + 🌿 肚脐护理',
        note: '已喂1粒D3，肚脐干爽无渗出'
      });
    }
  });

  // 按时间倒序排列
  records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return {
    isDemo: true,
    profile,
    records,
    dailyChecklist
  };
}

// ============================================================================
// 2. 数据加载、保存与本地 / GitHub 云端多端同步
// ============================================================================
async function initApp() {
  // 0. 检查是否有家人一键配对链接参数 ?sync_key=...
  checkUrlSyncPairing();

  // 1. 尝试从服务端加载（如果通过 server.py 启动）
  let loaded = null;
  try {
    const res = await fetch('/api/data', { cache: 'no-store' });
    if (res.ok) {
      const serverData = await res.json();
      if (serverData && Array.isArray(serverData.records)) {
        loaded = serverData;
      }
    }
  } catch (e) {
    // 静态打开或 GitHub Pages 模式，继续尝试本地缓存或直接读取仓库 data/baby_data.json
  }

  // 2. 尝试从 localStorage 加载
  if (!loaded) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.records)) {
          loaded = parsed;
        }
      }
    } catch (e) {
      console.warn('读取本地缓存失败', e);
    }
  }

  // 3. 若无数据则初始化 7 天演示数据
  if (loaded) {
    appState = { deletedIds: [], updatedAt: Date.now(), ...loaded };
  } else {
    appState = generateDemoData();
    await persistState(false);
  }

  // 初始化日期选择器为今天
  const todayStr = toLocalDateStr(new Date());
  const rhythmDateEl = document.getElementById('rhythmDateInput');
  if (rhythmDateEl) rhythmDateEl.value = todayStr;

  updateCloudSyncHeaderUI();
  renderAll();

  // 4. 如果已配置家庭 GitHub 云同步，启动时立即拉取并合并云端最新数据
  if (getCloudConfig()) {
    await syncWithGitHubCloud(false);
  }

  // 每30秒刷新实时时间，并在开启云同步时自动拉取家人最新记录
  setInterval(() => {
    updateLiveHeaderPills();
    if (getCloudConfig()) {
      syncWithGitHubCloud(false, true);
    }
  }, 30000);

  // 手机解锁或切回网页标签时立即同步一次
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && getCloudConfig()) {
      syncWithGitHubCloud(false, true);
    }
  });
}

async function persistState(pushToCloud = true) {
  appState.updatedAt = Date.now();
  if (!Array.isArray(appState.deletedIds)) appState.deletedIds = [];
  appState.records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.warn('写入 localStorage 失败', e);
  }

  // 同步到本地文件服务端 (server.py)
  try {
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appState)
    });
  } catch (e) {
    // 纯静态环境忽略
  }

  // 同步到 GitHub 家庭云端仓库
  if (pushToCloud && getCloudConfig()) {
    await syncWithGitHubCloud(true);
  }
}

async function loadDemoData(showAlert = false) {
  appState = generateDemoData();
  await persistState();
  renderAll();
  if (showAlert) showToast('🍬 已恢复 7 天新生儿示例数据！');
}

async function clearForRealBaby() {
  if (!confirm('确定要清空示例数据，开始记录你家宝宝的真实数据吗？\n（清空后会自动打开「宝宝档案设置」）')) {
    return;
  }
  const now = new Date();
  const prevDeleted = (appState.records || []).map(r => r.id);
  appState = {
    isDemo: false,
    updatedAt: Date.now(),
    deletedIds: prevDeleted,
    profile: {
      name: appState.profile.name || '我家宝宝',
      gender: appState.profile.gender || 'girl',
      birthDateTime: toDateTimeLocalStr(now),
      birthWeight: 3.30,
      birthLength: 50.0,
      feedIntervalHours: 3.0,
      milkFactor: 150
    },
    records: [],
    dailyChecklist: {}
  };
  await persistState();
  renderAll();
  openProfileModal();
  showToast('✨ 已开启真实记录模式，请设置宝宝出生信息！');
}

// ============================================================================
// 3. 全局界面渲染
// ============================================================================
function renderAll() {
  renderDemoBanner();
  renderHeaderProfile();
  updateLiveHeaderPills();
  renderKpiCards();
  renderDailyChecklist();
  renderAllCharts();
  render24hRhythm();
  renderLogList();
}

function renderDemoBanner() {
  const banner = document.getElementById('demoBanner');
  const syncText = document.getElementById('syncStatusText');
  if (!banner) return;
  if (appState.isDemo) {
    banner.style.display = 'flex';
    syncText.textContent = '当前展示的是 7 天新生儿示例数据，你可以随意点击体验，或点击右侧按钮开始记录真实宝宝数据。';
  } else {
    banner.style.background = 'linear-gradient(90deg, #ECFDF5 0%, #F0F9FF 100%)';
    banner.style.borderColor = '#6EE7B7';
    banner.innerHTML = `
      <div>
        💖 <strong>真实宝宝记录模式已开启</strong>
        <span style="color: var(--text-secondary); margin-left: 6px;">
          所有记录已自动保存在本地（共 ${appState.records.length} 条记录），可随时导出备份或同步到 GitHub。
        </span>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-sm btn-soft" onclick="loadDemoData(true)">🍬 查看示例数据</button>
      </div>
    `;
  }
}

function getLatestWeight() {
  const growthRec = appState.records.find(r => r.category === 'growth' && r.weightKg > 0);
  return growthRec ? Number(growthRec.weightKg) : Number(appState.profile.birthWeight || 3.25);
}

function renderHeaderProfile() {
  const p = appState.profile;
  document.getElementById('babyNameDisplay').textContent = p.name || '小糖果';
  document.querySelector('.baby-avatar').textContent = p.gender === 'boy' ? '👶🏻' : '👧🏻';

  // 计算出生天数和小时数
  const birth = new Date(p.birthDateTime || Date.now());
  const now = new Date();
  const diffMs = Math.max(0, now - birth);
  const totalHours = Math.floor(diffMs / (3600 * 1000));
  const days = Math.floor(totalHours / 24) + 1;
  const weeks = Math.floor((days - 1) / 7);
  const remDays = (days - 1) % 7;

  let ageText = `出生第 ${days} 天`;
  if (days <= 7) {
    ageText += ` (${totalHours}小时龄)`;
  } else if (weeks > 0) {
    ageText += ` (${weeks}周${remDays}天)`;
  }
  document.getElementById('babyAgeDisplay').textContent = ageText;

  const birthFormatted = p.birthDateTime ? p.birthDateTime.replace('T', ' ') : '--';
  document.getElementById('babyBirthDisplay').textContent = `🎂 ${birthFormatted}`;

  const currentWeight = getLatestWeight();
  const weightDiff = (currentWeight - Number(p.birthWeight)).toFixed(2);
  const sign = weightDiff >= 0 ? `+${weightDiff}` : `${weightDiff}`;
  document.getElementById('babyWeightDisplay').textContent =
    `⚖️ 当前 ${currentWeight.toFixed(2)} kg (较出生 ${sign} kg)`;

  const recDailyMilk = Math.round(currentWeight * (Number(p.milkFactor) || 150));
  const recSingleMilk = Math.round(recDailyMilk / 8);
  document.getElementById('babyRecommendMilk').textContent =
    `🍼 建议日总奶量: ${recDailyMilk} ml (约 ${recSingleMilk} ml/顿)`;

  // 更新右侧智能奶量计算器贴士
  const guideEl = document.getElementById('smartMilkGuideText');
  if (guideEl) {
    guideEl.innerHTML = `
      按宝宝当前体重 <strong>${currentWeight.toFixed(2)} kg</strong> × <strong>${p.milkFactor || 150} ml/kg/天</strong> 计算：<br/>
      • <strong>全天推荐总奶量</strong>：约 <strong>${recDailyMilk - 40} ~ ${recDailyMilk + 40} ml</strong><br/>
      • <strong>每顿推荐奶量（按每天8顿）</strong>：约 <strong>${recSingleMilk - 5} ~ ${recSingleMilk + 10} ml</strong><br/>
      • <strong>喂养间隔</strong>：每 <strong>${p.feedIntervalHours || 3} 小时</strong> 左右按需喂养。
    `;
  }
}

function formatDurationSince(isoStr) {
  if (!isoStr) return '暂无记录';
  const diffMin = Math.max(0, Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000));
  if (diffMin < 1) return '刚刚';
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h === 0) return `${m} 分钟前`;
  return `${h}小时 ${m}分前`;
}

function updateLiveHeaderPills() {
  // 1. 距离上次喂奶
  const lastFeed = appState.records.find(r => r.category === 'feed');
  const feedEl = document.getElementById('timeSinceFeed');
  const feedLabelEl = document.getElementById('nextFeedAlertLabel');
  if (lastFeed) {
    feedEl.textContent = formatDurationSince(lastFeed.timestamp);
    const intervalMin = (Number(appState.profile.feedIntervalHours) || 3) * 60;
    const elapsedMin = Math.floor((Date.now() - new Date(lastFeed.timestamp).getTime()) / 60000);
    const remainMin = intervalMin - elapsedMin;
    if (remainMin <= 0) {
      feedLabelEl.textContent = '🔔 已到喂奶时间！';
    } else {
      const rh = Math.floor(remainMin / 60);
      const rm = remainMin % 60;
      feedLabelEl.textContent = `距下次喂奶约 ${rh > 0 ? rh + 'h' : ''}${rm}m`;
    }
  } else {
    feedEl.textContent = '点击记录第一顿';
    feedLabelEl.textContent = '距离上次喂奶';
  }

  // 2. 距离上次换尿布
  const lastDiaper = appState.records.find(r => r.category === 'diaper');
  document.getElementById('timeSinceDiaper').textContent = lastDiaper
    ? formatDurationSince(lastDiaper.timestamp)
    : '点击记录尿布';

  // 3. 最新黄疸值
  const lastJaundice = appState.records.find(r => r.category === 'jaundice');
  const jPill = document.getElementById('latestJaundicePill');
  if (lastJaundice) {
    jPill.textContent = `${lastJaundice.valueMgDl} mg/dL`;
  } else {
    jPill.textContent = '未测量';
  }

  // 4. 今日维生素 (D3 / AD / K1) 打卡状态
  const vitPill = document.getElementById('todayVitaminsPill');
  if (vitPill) {
    const todayStr = toLocalDateStr(new Date());
    const dayMap = (appState.dailyChecklist && appState.dailyChecklist[todayStr]) || {};
    const todayCareRecs = appState.records.filter(
      r => r.category === 'care' && r.timestamp && r.timestamp.startsWith(todayStr)
    );
    const hasD3 = !!dayMap.vd3 || todayCareRecs.some(r => (r.careItem || '').toUpperCase().includes('D3'));
    const hasAD = !!dayMap.vad || todayCareRecs.some(r => (r.careItem || '').toUpperCase().includes('AD'));
    const hasK1 = !!dayMap.vk1 || todayCareRecs.some(r => (r.careItem || '').toUpperCase().includes('K1'));

    const parts = [];
    if (hasD3) parts.push('D3✓');
    if (hasAD) parts.push('AD✓');
    if (hasK1) parts.push('K1✓');
    vitPill.textContent = parts.length > 0 ? parts.join(' ') : '今日待喂';
  }
}

// ============================================================================
// 4. 顶部 4 大 KPI 指标卡渲染
// ============================================================================
function renderKpiCards() {
  const todayStr = toLocalDateStr(new Date());
  const todayRecs = appState.records.filter(r => r.timestamp && r.timestamp.startsWith(todayStr));

  // 1. 今日吃奶 KPI
  const todayFeeds = todayRecs.filter(r => r.category === 'feed');
  const totalMilk = todayFeeds.reduce((sum, r) => sum + (Number(r.amountMl) || 0), 0);
  const totalNursingMin = todayFeeds.reduce((sum, r) => sum + (Number(r.leftMin) || 0) + (Number(r.rightMin) || 0), 0);
  const targetMilk = Math.round(getLatestWeight() * (Number(appState.profile.milkFactor) || 150));
  const milkPct = Math.min(100, Math.round((totalMilk / Math.max(1, targetMilk)) * 100));

  document.getElementById('kpiMilkCountBadge').textContent = `今日 ${todayFeeds.length} 顿`;
  document.getElementById('kpiMilkTotal').innerHTML = `${totalMilk}<small>ml</small>`;
  document.getElementById('kpiMilkProgress').style.width = `${milkPct}%`;
  document.getElementById('kpiMilkSubLeft').textContent = `亲喂 ${totalNursingMin} 分钟`;
  document.getElementById('kpiMilkSubRight').textContent = `目标 ${targetMilk}ml (${milkPct}%)`;

  // 2. 今日换尿布 KPI
  const todayDiapers = todayRecs.filter(r => r.category === 'diaper');
  const wetCount = todayDiapers.filter(r => r.diaperType === 'wet' || r.diaperType === 'both').length;
  const dirtyCount = todayDiapers.filter(r => r.diaperType === 'dirty' || r.diaperType === 'both').length;
  const diaperPct = Math.min(100, Math.round((todayDiapers.length / 6) * 100));

  document.getElementById('kpiDiaperTotal').innerHTML = `${todayDiapers.length}<small>次</small>`;
  document.getElementById('kpiDiaperProgress').style.width = `${diaperPct}%`;
  document.getElementById('kpiDiaperBreakdown').textContent = `💧嘘嘘 ${wetCount} · 💩便便 ${dirtyCount}`;
  const diaperBadge = document.getElementById('kpiDiaperStatusBadge');
  if (todayDiapers.length >= 6) {
    diaperBadge.textContent = '✨ 排泄量充足';
    diaperBadge.className = 'kpi-badge mint';
  } else {
    diaperBadge.textContent = `还差 ${Math.max(0, 6 - todayDiapers.length)} 次达标`;
    diaperBadge.className = 'kpi-badge sky';
  }

  // 3. 最新黄疸 KPI
  const latestJ = appState.records.find(r => r.category === 'jaundice');
  const jBadge = document.getElementById('kpiJaundiceRiskBadge');
  if (latestJ) {
    const val = Number(latestJ.valueMgDl);
    const umol = Math.round(val * 17.1);
    document.getElementById('kpiJaundiceValue').innerHTML = `${val.toFixed(1)}<small>mg/dL</small>`;
    document.getElementById('kpiJaundiceParts').textContent =
      `额头 ${latestJ.forehead ?? val} / 胸口 ${latestJ.chest ?? val}`;
    document.getElementById('kpiJaundiceUmol').textContent = `≈ ${umol} μmol/L`;
    const jPct = Math.min(100, Math.round((val / 18) * 100));
    document.getElementById('kpiJaundiceProgress').style.width = `${jPct}%`;

    if (val >= 15) {
      jBadge.textContent = '⚠️ 偏高建议就医';
      jBadge.className = 'kpi-badge coral';
    } else if (val >= 12.5) {
      jBadge.textContent = '🔍 密切观察退黄';
      jBadge.className = 'kpi-badge lemon';
    } else {
      jBadge.textContent = '✅ 生理安全范围';
      jBadge.className = 'kpi-badge mint';
    }
  } else {
    document.getElementById('kpiJaundiceValue').innerHTML = `--<small>mg/dL</small>`;
    document.getElementById('kpiJaundiceParts').textContent = '暂无测量记录';
    document.getElementById('kpiJaundiceUmol').textContent = '≈ -- μmol/L';
    document.getElementById('kpiJaundiceProgress').style.width = '0%';
  }

  // 4. 今日睡眠与最新体温 KPI
  const todaySleeps = todayRecs.filter(r => r.category === 'sleep');
  const totalSleepMin = todaySleeps.reduce((sum, r) => sum + (Number(r.durationMin) || 0), 0);
  const sleepHours = (totalSleepMin / 60).toFixed(1);
  const sleepPct = Math.min(100, Math.round((totalSleepMin / (15 * 60)) * 100));

  document.getElementById('kpiSleepCountBadge').textContent = `${todaySleeps.length} 段睡眠`;
  document.getElementById('kpiSleepTotal').innerHTML = `${sleepHours}<small>小时</small>`;
  document.getElementById('kpiSleepProgress').style.width = `${sleepPct}%`;

  const latestTempRec = appState.records.find(r => r.category === 'growth' && r.tempC > 0);
  document.getElementById('kpiTempLatest').textContent = latestTempRec
    ? `🌡️ 体温 ${Number(latestTempRec.tempC).toFixed(1)}°C`
    : '🌡️ 体温 --°C';
}

// ============================================================================
// 5. 今日必做护理清单
// ============================================================================
function renderDailyChecklist() {
  const todayStr = toLocalDateStr(new Date());
  document.getElementById('checklistDateLabel').textContent = todayStr;
  if (!appState.dailyChecklist[todayStr]) {
    appState.dailyChecklist[todayStr] = {};
  }
  const dayMap = appState.dailyChecklist[todayStr];
  const grid = document.getElementById('dailyChecklistGrid');

  grid.innerHTML = CARE_CHECKLIST_ITEMS.map(item => {
    const done = !!dayMap[item.id];
    return `
      <div class="check-item ${done ? 'done' : ''}" onclick="toggleChecklistItem('${item.id}')">
        <div class="check-box">${done ? '✓' : ''}</div>
        <div class="check-label">${item.icon} ${item.label}</div>
      </div>
    `;
  }).join('');
}

async function toggleChecklistItem(itemId) {
  const todayStr = toLocalDateStr(new Date());
  if (!appState.dailyChecklist[todayStr]) {
    appState.dailyChecklist[todayStr] = {};
  }
  const newState = !appState.dailyChecklist[todayStr][itemId];
  appState.dailyChecklist[todayStr][itemId] = newState;

  const item = CARE_CHECKLIST_ITEMS.find(i => i.id === itemId);
  // 如果勾选了维生素 D3 / AD / K1 等护理项，且今日时间轴尚未记录，则自动写入一条带时间的记录
  if (newState && item && item.recordTitle) {
    const keyword = itemId === 'vd3' ? 'D3' : itemId === 'vad' ? 'AD' : itemId === 'vk1' ? 'K1' : item.label.slice(0, 2);
    const alreadyLogged = appState.records.some(
      r => r.category === 'care' && r.timestamp && r.timestamp.startsWith(todayStr) && (r.careItem || '').includes(keyword)
    );
    if (!alreadyLogged) {
      appState.records.unshift({
        id: uid(),
        category: 'care',
        timestamp: toDateTimeLocalStr(new Date()),
        careItem: item.recordTitle,
        note: '通过今日必做护理清单快捷打卡'
      });
    }
  }

  await persistState();
  renderAll();
  if (newState && item) {
    showToast(`✅ 已完成打卡：${item.label}`);
  }
}

// ============================================================================
// 6. 可视化 SVG 图表引擎（零外部依赖，高颜值糖果色渐变图表）
// ============================================================================
function setChartDays(days, btnEl) {
  currentChartDays = days;
  document.querySelectorAll('#chartRangeTabs .candy-tab').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderAllCharts();
}

function getDateSeries(numDays) {
  const dates = [];
  const today = new Date();
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    dates.push(toLocalDateStr(d));
  }
  return dates;
}

function renderAllCharts() {
  renderMilkChart();
  renderJaundiceChart();
  renderDiaperChart();
  renderGrowthChart();
}

// 图表 1：每日吃奶量堆叠柱状图 + 喂奶次数折线图
function renderMilkChart() {
  const container = document.getElementById('milkChartContainer');
  const dates = getDateSeries(currentChartDays);
  const dailyData = dates.map(dStr => {
    const recs = appState.records.filter(r => r.category === 'feed' && r.timestamp.startsWith(dStr));
    const formulaMl = recs
      .filter(r => r.feedType !== 'breast_bottle')
      .reduce((s, r) => s + (Number(r.amountMl) || 0), 0);
    const breastMl = recs
      .filter(r => r.feedType === 'breast_bottle')
      .reduce((s, r) => s + (Number(r.amountMl) || 0), 0);
    return {
      date: dStr,
      label: formatShortDate(dStr),
      formulaMl,
      breastMl,
      totalMl: formulaMl + breastMl,
      count: recs.length
    };
  });

  const W = 520, H = 220, padL = 42, padR = 32, padT = 22, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const targetMilk = Math.round(getLatestWeight() * (Number(appState.profile.milkFactor) || 150));
  const maxMilk = Math.max(600, targetMilk + 80, ...dailyData.map(d => d.totalMl));
  const maxCount = Math.max(12, ...dailyData.map(d => d.count));

  const stepX = plotW / dates.length;
  const barW = Math.min(26, Math.max(8, stepX * 0.52));

  let gridSvg = '';
  for (let i = 0; i <= 4; i++) {
    const val = Math.round((maxMilk / 4) * i);
    const y = padT + plotH - (i / 4) * plotH;
    gridSvg += `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#F3E5EC" stroke-dasharray="3,3" />
      <text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9E8B9F">${val}</text>
    `;
  }

  // 推荐日奶量参考线
  const targetY = padT + plotH - (targetMilk / maxMilk) * plotH;
  const targetLineSvg = `
    <line x1="${padL}" y1="${targetY}" x2="${W - padR}" y2="${targetY}" stroke="#FF6B9D" stroke-width="1.5" stroke-dasharray="5,4" />
    <text x="${W - padR - 2}" y="${targetY - 4}" text-anchor="end" font-size="9.5" font-weight="700" fill="#D94678">推荐 ${targetMilk}ml</text>
  `;

  let barsSvg = '';
  let linePoints = [];
  let dotsSvg = '';

  dailyData.forEach((d, idx) => {
    const cx = padL + idx * stepX + stepX / 2;
    const fH = (d.formulaMl / maxMilk) * plotH;
    const bH = (d.breastMl / maxMilk) * plotH;
    const fy = padT + plotH - fH;
    const by = fy - bH;

    barsSvg += `
      <g>
        <title>${d.date}\n总奶量: ${d.totalMl} ml (配方奶 ${d.formulaMl}ml / 瓶喂母乳 ${d.breastMl}ml)\n喂奶次数: ${d.count} 次</title>
        <rect x="${cx - barW / 2}" y="${fy}" width="${barW}" height="${Math.max(0, fH)}" rx="4" fill="#FF6B9D" />
        <rect x="${cx - barW / 2}" y="${by}" width="${barW}" height="${Math.max(0, bH)}" rx="4" fill="#FF9EBB" />
        ${d.totalMl > 0 && dates.length <= 14 ? `<text x="${cx}" y="${by - 5}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#D94678">${d.totalMl}</text>` : ''}
        ${(dates.length <= 10 || idx % Math.ceil(dates.length / 8) === 0) ? `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#6E5A70">${d.label}</text>` : ''}
      </g>
    `;

    const countY = padT + plotH - (d.count / maxCount) * plotH;
    linePoints.push(`${cx},${countY}`);
    dotsSvg += `<circle cx="${cx}" cy="${countY}" r="3.5" fill="#7C3AED" stroke="#fff" stroke-width="1.5"><title>${d.date}: 喂奶 ${d.count} 次</title></circle>`;
  });

  const polylineSvg = linePoints.length > 1
    ? `<polyline fill="none" stroke="#A78BFA" stroke-width="2" points="${linePoints.join(' ')}" />`
    : '';

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${gridSvg}
      ${targetLineSvg}
      ${barsSvg}
      ${polylineSvg}
      ${dotsSvg}
    </svg>
  `;
}

// 图表 2：新生儿黄疸变化曲线 (mg/dL)
function renderJaundiceChart() {
  const container = document.getElementById('jaundiceChartContainer');
  const cutoffDate = getDateSeries(currentChartDays)[0];
  const jRecs = appState.records
    .filter(r => r.category === 'jaundice' && r.timestamp.slice(0, 10) >= cutoffDate)
    .slice()
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const W = 520, H = 220, padL = 38, padR = 24, padT = 20, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxVal = 20;

  let gridSvg = '';
  [0, 5, 10, 15, 20].forEach(val => {
    const y = padT + plotH - (val / maxVal) * plotH;
    gridSvg += `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#F3E5EC" stroke-dasharray="3,3" />
      <text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9E8B9F">${val}</text>
    `;
  });

  // 15 mg/dL 警戒线 & 12.9 mg/dL 生理性参考线
  const warn15Y = padT + plotH - (15 / maxVal) * plotH;
  const ref12Y = padT + plotH - (12.9 / maxVal) * plotH;
  const refLines = `
    <rect x="${padL}" y="${padT}" width="${plotW}" height="${warn15Y - padT}" fill="rgba(244, 63, 94, 0.06)" />
    <line x1="${padL}" y1="${warn15Y}" x2="${W - padR}" y2="${warn15Y}" stroke="#F43F5E" stroke-width="1.5" stroke-dasharray="5,4" />
    <text x="${W - padR - 4}" y="${warn15Y - 4}" text-anchor="end" font-size="9.5" font-weight="700" fill="#F43F5E">15.0 干预警戒线</text>
    <line x1="${padL}" y1="${ref12Y}" x2="${W - padR}" y2="${ref12Y}" stroke="#F59E0B" stroke-width="1.2" stroke-dasharray="3,3" />
    <text x="${W - padR - 4}" y="${ref12Y + 11}" text-anchor="end" font-size="9" fill="#D97706">12.9 生理峰值参考</text>
  `;

  if (jRecs.length === 0) {
    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${gridSvg}${refLines}<text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#9E8B9F" font-size="13">暂无黄疸测量数据，点击上方「测黄疸值」添加</text></svg>`;
    return;
  }

  const avgPts = [], fhPts = [], chPts = [];
  let dotsSvg = '';

  jRecs.forEach((r, idx) => {
    const cx = jRecs.length === 1
      ? padL + plotW / 2
      : padL + (idx / (jRecs.length - 1)) * plotW;

    const avgV = Number(r.valueMgDl) || 0;
    const fhV = Number(r.forehead ?? avgV);
    const chV = Number(r.chest ?? avgV);

    const avgY = padT + plotH - (Math.min(maxVal, avgV) / maxVal) * plotH;
    const fhY = padT + plotH - (Math.min(maxVal, fhV) / maxVal) * plotH;
    const chY = padT + plotH - (Math.min(maxVal, chV) / maxVal) * plotH;

    avgPts.push(`${cx},${avgY}`);
    fhPts.push(`${cx},${fhY}`);
    chPts.push(`${cx},${chY}`);

    const labelStr = formatShortDate(r.timestamp.slice(0, 10));
    const showLabel = jRecs.length <= 8 || idx % Math.ceil(jRecs.length / 6) === 0 || idx === jRecs.length - 1;

    dotsSvg += `
      <g>
        <title>${r.timestamp.replace('T', ' ')}\n平均值: ${avgV} mg/dL (≈${Math.round(avgV * 17.1)} μmol/L)\n额头: ${fhV} / 胸口: ${chV}</title>
        <circle cx="${cx}" cy="${fhY}" r="3" fill="#FB923C" />
        <circle cx="${cx}" cy="${chY}" r="3" fill="#38BDF8" />
        <circle cx="${cx}" cy="${avgY}" r="4.5" fill="#F59E0B" stroke="#fff" stroke-width="1.5" />
        ${showLabel ? `<text x="${cx}" y="${avgY - 8}" text-anchor="middle" font-size="9.5" font-weight="800" fill="#B45309">${avgV}</text>` : ''}
        ${showLabel ? `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="#6E5A70">${labelStr}</text>` : ''}
      </g>
    `;
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${gridSvg}
      ${refLines}
      ${fhPts.length > 1 ? `<polyline fill="none" stroke="#FB923C" stroke-width="1.5" stroke-dasharray="2,2" points="${fhPts.join(' ')}" />` : ''}
      ${chPts.length > 1 ? `<polyline fill="none" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="2,2" points="${chPts.join(' ')}" />` : ''}
      ${avgPts.length > 1 ? `<polyline fill="none" stroke="#F59E0B" stroke-width="2.8" points="${avgPts.join(' ')}" />` : ''}
      ${dotsSvg}
    </svg>
  `;
}

// 图表 3：每日尿布排泄堆叠柱状图
function renderDiaperChart() {
  const container = document.getElementById('diaperChartContainer');
  const dates = getDateSeries(currentChartDays);
  const dailyData = dates.map(dStr => {
    const recs = appState.records.filter(r => r.category === 'diaper' && r.timestamp.startsWith(dStr));
    const wet = recs.filter(r => r.diaperType === 'wet').length;
    const dirty = recs.filter(r => r.diaperType === 'dirty').length;
    const both = recs.filter(r => r.diaperType === 'both').length;
    return {
      date: dStr,
      label: formatShortDate(dStr),
      wet,
      dirty,
      both,
      total: wet + dirty + both
    };
  });

  const W = 520, H = 220, padL = 36, padR = 24, padT = 22, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const maxCount = Math.max(10, ...dailyData.map(d => d.total + 2));

  const stepX = plotW / dates.length;
  const barW = Math.min(26, Math.max(8, stepX * 0.52));

  let gridSvg = '';
  [0, 3, 6, 9, 12].filter(v => v <= maxCount).forEach(val => {
    const y = padT + plotH - (val / maxCount) * plotH;
    gridSvg += `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#F3E5EC" stroke-dasharray="3,3" />
      <text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9E8B9F">${val}</text>
    `;
  });

  // 每天 6 次湿尿布达标线
  const ref6Y = padT + plotH - (6 / maxCount) * plotH;
  const refLine = `
    <line x1="${padL}" y1="${ref6Y}" x2="${W - padR}" y2="${ref6Y}" stroke="#34D399" stroke-width="1.5" stroke-dasharray="5,4" />
    <text x="${W - padR - 4}" y="${ref6Y - 4}" text-anchor="end" font-size="9.5" font-weight="700" fill="#059669">达标线 6次/天</text>
  `;

  let barsSvg = '';
  dailyData.forEach((d, idx) => {
    const cx = padL + idx * stepX + stepX / 2;
    const hWet = (d.wet / maxCount) * plotH;
    const hDirty = (d.dirty / maxCount) * plotH;
    const hBoth = (d.both / maxCount) * plotH;

    const yWet = padT + plotH - hWet;
    const yDirty = yWet - hDirty;
    const yBoth = yDirty - hBoth;

    barsSvg += `
      <g>
        <title>${d.date} 共换尿布 ${d.total} 次\n💧纯嘘嘘: ${d.wet} 次\n💩纯便便: ${d.dirty} 次\n💧+💩混合: ${d.both} 次</title>
        <rect x="${cx - barW / 2}" y="${yWet}" width="${barW}" height="${hWet}" rx="3" fill="#38BDF8" />
        <rect x="${cx - barW / 2}" y="${yDirty}" width="${barW}" height="${hDirty}" rx="3" fill="#FBBF24" />
        <rect x="${cx - barW / 2}" y="${yBoth}" width="${barW}" height="${hBoth}" rx="3" fill="#34D399" />
        ${d.total > 0 && dates.length <= 14 ? `<text x="${cx}" y="${yBoth - 5}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#0284C7">${d.total}</text>` : ''}
        ${(dates.length <= 10 || idx % Math.ceil(dates.length / 8) === 0) ? `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#6E5A70">${d.label}</text>` : ''}
      </g>
    `;
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${gridSvg}
      ${refLine}
      ${barsSvg}
    </svg>
  `;
}

// 图表 4：体重生长曲线 (kg)
function renderGrowthChart() {
  const container = document.getElementById('growthChartContainer');
  const gRecs = appState.records
    .filter(r => r.category === 'growth' && r.weightKg > 0)
    .slice()
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const W = 520, H = 220, padL = 42, padR = 24, padT = 22, padB = 30;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const birthW = Number(appState.profile.birthWeight) || 3.25;
  const weights = gRecs.map(r => Number(r.weightKg));
  const minW = Math.max(1.5, Math.min(birthW, ...weights) - 0.25);
  const maxW = Math.max(birthW, ...weights) + 0.25;

  let gridSvg = '';
  for (let i = 0; i <= 4; i++) {
    const val = (minW + ((maxW - minW) / 4) * i).toFixed(2);
    const y = padT + plotH - (i / 4) * plotH;
    gridSvg += `
      <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#F3E5EC" stroke-dasharray="3,3" />
      <text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="9.5" fill="#9E8B9F">${val}</text>
    `;
  }

  const birthY = padT + plotH - ((birthW - minW) / (maxW - minW)) * plotH;
  const birthLine = `
    <line x1="${padL}" y1="${birthY}" x2="${W - padR}" y2="${birthY}" stroke="#F43F5E" stroke-width="1.4" stroke-dasharray="4,4" />
    <text x="${W - padR - 4}" y="${birthY - 5}" text-anchor="end" font-size="9.5" font-weight="700" fill="#F43F5E">出生体重 ${birthW}kg</text>
  `;

  if (gRecs.length === 0) {
    container.innerHTML = `<svg viewBox="0 0 ${W} ${H}">${gridSvg}${birthLine}<text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#9E8B9F" font-size="13">暂无体重记录，点击上方「体重 & 体温」添加</text></svg>`;
    return;
  }

  const pts = [];
  let dotsSvg = '';
  gRecs.forEach((r, idx) => {
    const cx = gRecs.length === 1
      ? padL + plotW / 2
      : padL + (idx / (gRecs.length - 1)) * plotW;
    const w = Number(r.weightKg);
    const cy = padT + plotH - ((w - minW) / (maxW - minW)) * plotH;
    pts.push(`${cx},${cy}`);

    const labelStr = formatShortDate(r.timestamp.slice(0, 10));
    dotsSvg += `
      <g>
        <title>${r.timestamp.slice(0, 10)}\n体重: ${w} kg\n体温: ${r.tempC || '--'} °C\n身长: ${r.lengthCm || '--'} cm</title>
        <circle cx="${cx}" cy="${cy}" r="4.5" fill="#10B981" stroke="#fff" stroke-width="1.5" />
        <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="9.5" font-weight="800" fill="#059669">${w.toFixed(2)}</text>
        <text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="#6E5A70">${labelStr}</text>
      </g>
    `;
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${gridSvg}
      ${birthLine}
      ${pts.length > 1 ? `<polyline fill="none" stroke="#10B981" stroke-width="2.8" points="${pts.join(' ')}" />` : ''}
      ${dotsSvg}
    </svg>
  `;
}

// 图表 5：24 小时作息生物钟甘特图
function render24hRhythm() {
  const dateInput = document.getElementById('rhythmDateInput');
  const targetDate = (dateInput && dateInput.value) ? dateInput.value : toLocalDateStr(new Date());
  const dayRecs = appState.records.filter(r => r.timestamp && r.timestamp.startsWith(targetDate));

  const track = document.getElementById('rhythmTrack');
  const summaryEl = document.getElementById('rhythmSummaryText');

  if (dayRecs.length === 0) {
    track.innerHTML = `<div style="height:100%; display:flex; align-items:center; justify-content:center; color:#9E8B9F; font-size:0.82rem;">${targetDate} 当天暂无记录</div>`;
    summaryEl.textContent = '';
    return;
  }

  let html = '';
  dayRecs.forEach(r => {
    const d = new Date(r.timestamp);
    const startMin = d.getHours() * 60 + d.getMinutes();
    const leftPct = (startMin / 1440) * 100;

    if (r.category === 'sleep') {
      const dur = Number(r.durationMin) || 60;
      const widthPct = Math.min(100 - leftPct, Math.max(1.5, (dur / 1440) * 100));
      html += `
        <div class="rhythm-event" style="left:${leftPct}%; width:${widthPct}%; background:rgba(196, 181, 253, 0.72); border:1px solid #A78BFA;"
             title="💤 ${formatTimeHM(r.timestamp)} 睡眠 ${(dur/60).toFixed(1)} 小时">
          💤
        </div>
      `;
    } else {
      let bg = '#FF6B9D', icon = '🍼', title = '';
      if (r.category === 'feed') {
        bg = '#FF6B9D'; icon = '🍼';
        title = `🍼 ${formatTimeHM(r.timestamp)} 喂奶 ${r.amountMl ? r.amountMl + 'ml' : '亲喂'}`;
      } else if (r.category === 'diaper') {
        bg = '#38BDF8'; icon = '🧷';
        title = `🧷 ${formatTimeHM(r.timestamp)} 换尿布 (${r.diaperType === 'wet' ? '嘘嘘' : r.diaperType === 'dirty' ? '便便' : '大小便'})`;
      } else if (r.category === 'jaundice') {
        bg = '#FBBF24'; icon = '🌞';
        title = `🌞 ${formatTimeHM(r.timestamp)} 黄疸 ${r.valueMgDl} mg/dL`;
      } else if (r.category === 'care' || r.category === 'growth') {
        bg = '#34D399'; icon = '💊';
        title = `💊 ${formatTimeHM(r.timestamp)} ${r.careItem || ('体重 ' + r.weightKg + 'kg')}`;
      }
      html += `
        <div class="rhythm-event" style="left:${leftPct}%; width:1.6%; min-width:18px; background:${bg}; color:#fff; z-index:2;"
             title="${title}">
          ${icon}
        </div>
      `;
    }
  });

  track.innerHTML = html;

  const fCount = dayRecs.filter(r => r.category === 'feed').length;
  const fMl = dayRecs.filter(r => r.category === 'feed').reduce((s, r) => s + (Number(r.amountMl) || 0), 0);
  const dCount = dayRecs.filter(r => r.category === 'diaper').length;
  const sHours = (dayRecs.filter(r => r.category === 'sleep').reduce((s, r) => s + (Number(r.durationMin) || 0), 0) / 60).toFixed(1);

  summaryEl.innerHTML = `📅 <strong>${targetDate} 全天汇总</strong>：共喂奶 <strong>${fCount}</strong> 次（总计 <strong>${fMl} ml</strong>） · 换尿布 <strong>${dCount}</strong> 次 · 累计睡眠 <strong>${sHours}</strong> 小时`;
}

// ============================================================================
// 7. 历史记录时间轴列表与筛选
// ============================================================================
function setLogFilter(cat, btnEl) {
  currentLogFilter = cat;
  document.querySelectorAll('#logFilterTabs .candy-tab').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderLogList();
}

function renderLogList() {
  const container = document.getElementById('logListContainer');
  const filterDate = document.getElementById('filterDateInput').value;

  const filtered = appState.records.filter(r => {
    if (currentLogFilter !== 'all' && r.category !== currentLogFilter) return false;
    if (filterDate && (!r.timestamp || !r.timestamp.startsWith(filterDate))) return false;
    return true;
  });

  document.getElementById('logCountLabel').textContent = `共 ${filtered.length} 条记录`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:36px 20px; color:var(--text-muted);">
        🍬 当前筛选条件下暂无记录，点击上方糖果卡片添加第一条记录吧！
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.slice(0, 120).map(r => {
    const meta = formatRecordDisplay(r);
    const dtParts = (r.timestamp || '').split('T');
    return `
      <div class="log-item">
        <div class="log-left">
          <div class="log-type-icon" style="background:${meta.bg}">${meta.icon}</div>
          <div class="log-content">
            <h4>
              ${meta.title}
              ${meta.badge ? `<span class="kpi-badge ${meta.badgeColor}">${meta.badge}</span>` : ''}
            </h4>
            <p>${meta.desc}${r.note ? ` · 💬 ${r.note}` : ''}</p>
          </div>
        </div>
        <div class="log-right">
          <div class="log-time">
            <div>${dtParts[1] || ''}</div>
            <div style="font-size:0.72rem; opacity:0.8;">${dtParts[0] || ''}</div>
          </div>
          <button class="log-delete-btn" onclick="deleteRecord('${r.id}')" title="删除此条记录">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

function formatRecordDisplay(r) {
  if (r.category === 'feed') {
    const typeMap = {
      formula: '配方奶',
      breast_bottle: '瓶喂母乳',
      nursing: '亲喂母乳',
      mixed: '混合喂养'
    };
    const tName = typeMap[r.feedType] || '喂奶';
    const badge = r.amountMl > 0 ? `${r.amountMl} ml` : `左${r.leftMin || 0}m / 右${r.rightMin || 0}m`;
    return {
      icon: '🍼',
      bg: 'var(--candy-pink-light)',
      title: tName,
      badge,
      badgeColor: 'pink',
      desc: `${r.burped || '已拍嗝'} · ${r.spitUp || '无溢奶'}`
    };
  }
  if (r.category === 'diaper') {
    const dMap = { wet: '💧 嘘嘘 (小便)', dirty: '💩 便便 (大便)', both: '💧+💩 大小便混合' };
    return {
      icon: '🧷',
      bg: 'var(--candy-sky-light)',
      title: dMap[r.diaperType] || '换尿布',
      badge: r.poopColor || r.amountLevel || '正常',
      badgeColor: r.poopColor === '灰白/异常' ? 'coral' : 'sky',
      desc: [r.poopTexture, r.rashStatus].filter(Boolean).join(' · ') || '尿布清爽'
    };
  }
  if (r.category === 'jaundice') {
    const val = Number(r.valueMgDl || 0);
    const umol = Math.round(val * 17.1);
    return {
      icon: '🌞',
      bg: 'var(--candy-lemon-light)',
      title: `黄疸指数 ${val} mg/dL`,
      badge: `≈ ${umol} μmol/L`,
      badgeColor: val >= 15 ? 'coral' : (val >= 12.5 ? 'lemon' : 'mint'),
      desc: `额头 ${r.forehead ?? val} / 胸口 ${r.chest ?? val} · ${r.therapyStatus || '居家观察'}`
    };
  }
  if (r.category === 'sleep') {
    const hrs = ((Number(r.durationMin) || 0) / 60).toFixed(1);
    return {
      icon: '💤',
      bg: 'var(--candy-lavender-light)',
      title: `睡眠 ${hrs} 小时 (${r.durationMin}分钟)`,
      badge: r.sootheMethod || '安睡',
      badgeColor: 'lavender',
      desc: `睡眠质量：${r.sleepQuality || '安稳香甜'}`
    };
  }
  if (r.category === 'growth') {
    return {
      icon: '📏',
      bg: 'var(--candy-mint-light)',
      title: `体重 ${r.weightKg || '--'} kg · 体温 ${r.tempC || '--'} °C`,
      badge: r.lengthCm ? `身长 ${r.lengthCm}cm` : '体征记录',
      badgeColor: 'mint',
      desc: `头围 ${r.headCm || '--'} cm`
    };
  }
  return {
    icon: '💊',
    bg: 'var(--candy-peach-light)',
    title: r.careItem || '日常护理与大事记',
    badge: '已打卡',
    badgeColor: 'pink',
    desc: '宝宝健康护理'
  };
}

async function deleteRecord(id) {
  if (!Array.isArray(appState.deletedIds)) appState.deletedIds = [];
  if (!appState.deletedIds.includes(id)) appState.deletedIds.push(id);
  appState.records = appState.records.filter(r => r.id !== id);
  await persistState();
  renderAll();
  showToast('🗑️ 已删除该条记录');
}

// ============================================================================
// 8. 弹窗表单与动态字段渲染
// ============================================================================
function openRecordModal(cat = 'feed', prefill = {}) {
  document.getElementById('recordTimestamp').value = toDateTimeLocalStr(new Date());
  document.getElementById('recordNote').value = prefill.note || '';
  switchModalCategory(cat, prefill);
  document.getElementById('recordModalBackdrop').classList.add('open');
}

function closeRecordModal() {
  document.getElementById('recordModalBackdrop').classList.remove('open');
}

function switchModalCategory(cat, prefill = {}) {
  currentModalCategory = cat;
  document.querySelectorAll('#modalCategoryTabs .candy-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });

  const titleMap = {
    feed: '🍼 记录宝宝吃奶',
    diaper: '🧷 记录换尿布与便便',
    jaundice: '🌞 记录新生儿黄疸值',
    sleep: '💤 记录宝宝睡眠',
    growth: '📏 记录体重、身长与体温',
    care: '💊 记录护理与成长大事记'
  };
  document.getElementById('recordModalTitle').textContent = titleMap[cat] || '新增记录';

  const box = document.getElementById('modalDynamicFields');

  if (cat === 'feed') {
    const lastFeed = appState.records.find(r => r.category === 'feed' && r.amountMl > 0);
    const defaultMl = prefill.amountMl ?? (lastFeed ? lastFeed.amountMl : 60);
    const defaultType = prefill.feedType || 'formula';
    box.innerHTML = `
      <div class="form-group">
        <label>喂养方式</label>
        <input type="hidden" id="f_feedType" value="${defaultType}" />
        <div class="pill-selector">
          <button type="button" class="pill-option ${defaultType==='formula'?'selected':''}" onclick="selectPill(this, 'f_feedType', 'formula')">🍼 配方奶</button>
          <button type="button" class="pill-option ${defaultType==='breast_bottle'?'selected':''}" onclick="selectPill(this, 'f_feedType', 'breast_bottle')">🤱 瓶喂母乳</button>
          <button type="button" class="pill-option ${defaultType==='nursing'?'selected':''}" onclick="selectPill(this, 'f_feedType', 'nursing')">💖 亲喂母乳</button>
          <button type="button" class="pill-option ${defaultType==='mixed'?'selected':''}" onclick="selectPill(this, 'f_feedType', 'mixed')">✨ 混合喂养</button>
        </div>
      </div>

      <div class="form-group">
        <label>吃奶量 (ml) — 亲喂可填 0</label>
        <input type="number" id="f_amountMl" class="form-input" value="${defaultMl}" min="0" max="350" step="5" />
        <div class="preset-chips">
          ${[30, 45, 60, 75, 90, 105, 120, 150].map(v =>
            `<span class="preset-chip" onclick="document.getElementById('f_amountMl').value=${v}">${v}ml</span>`
          ).join('')}
          <span class="preset-chip" onclick="document.getElementById('f_amountMl').value = Math.max(0, Number(document.getElementById('f_amountMl').value)+10)">+10ml</span>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>👈 左乳亲喂时长 (分钟)</label>
          <input type="number" id="f_leftMin" class="form-input" value="${prefill.leftMin || 0}" min="0" max="90" />
        </div>
        <div class="form-group">
          <label>👉 右乳亲喂时长 (分钟)</label>
          <input type="number" id="f_rightMin" class="form-input" value="${prefill.rightMin || 0}" min="0" max="90" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>拍嗝情况</label>
          <select id="f_burped" class="form-select">
            <option value="已拍嗝">✅ 已拍出嗝</option>
            <option value="未拍出">⏳ 拍了未出嗝</option>
            <option value="睡着未拍">💤 吃睡着未拍</option>
          </select>
        </div>
        <div class="form-group">
          <label>吐奶 / 溢奶</label>
          <select id="f_spitUp" class="form-select">
            <option value="无溢奶">✨ 无溢奶</option>
            <option value="轻微溢奶">💧 嘴角轻微溢奶</option>
            <option value="吐奶较多">⚠️ 吐奶较多</option>
          </select>
        </div>
      </div>
    `;
  } else if (cat === 'diaper') {
    box.innerHTML = `
      <div class="form-group">
        <label>尿布状态</label>
        <input type="hidden" id="d_diaperType" value="wet" />
        <div class="pill-selector">
          <button type="button" class="pill-option selected" onclick="selectPill(this, 'd_diaperType', 'wet')">💧 嘘嘘 (小便)</button>
          <button type="button" class="pill-option" onclick="selectPill(this, 'd_diaperType', 'dirty')">💩 便便 (大便)</button>
          <button type="button" class="pill-option" onclick="selectPill(this, 'd_diaperType', 'both')">💧+💩 大小便都有</button>
        </div>
      </div>

      <div class="form-group">
        <label>便便颜色色卡（如有大便请选择）</label>
        <input type="hidden" id="d_poopColor" value="金黄色" />
        <div class="poop-color-grid">
          <div class="poop-swatch selected" onclick="selectSwatch(this, 'd_poopColor', '金黄色')">
            <span class="swatch-circle" style="background:#F59E0B"></span>金黄色
          </div>
          <div class="poop-swatch" onclick="selectSwatch(this, 'd_poopColor', '黄色')">
            <span class="swatch-circle" style="background:#FACC15"></span>黄色
          </div>
          <div class="poop-swatch" onclick="selectSwatch(this, 'd_poopColor', '黄绿色')">
            <span class="swatch-circle" style="background:#84CC16"></span>黄绿色
          </div>
          <div class="poop-swatch" onclick="selectSwatch(this, 'd_poopColor', '墨绿胎便')">
            <span class="swatch-circle" style="background:#14532D"></span>墨绿胎便
          </div>
          <div class="poop-swatch" onclick="selectSwatch(this, 'd_poopColor', '褐色')">
            <span class="swatch-circle" style="background:#78350F"></span>褐色
          </div>
          <div class="poop-swatch" onclick="selectSwatch(this, 'd_poopColor', '灰白/异常')">
            <span class="swatch-circle" style="background:#E5E7EB"></span>⚠️灰白/异常
          </div>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>便便性状</label>
          <select id="d_poopTexture" class="form-select">
            <option value="糊状">🍯 软糊状 (正常)</option>
            <option value="奶瓣便">🥛 含少量奶瓣</option>
            <option value="黏稠胎便">🌿 黏稠胎便</option>
            <option value="偏稀水样">💦 偏稀 / 水样</option>
            <option value="偏干">🪨 偏稠 / 偏干</option>
          </select>
        </div>
        <div class="form-group">
          <label>小屁屁皮肤状态</label>
          <select id="d_rashStatus" class="form-select">
            <option value="小屁屁正常">🍑 皮肤白净正常</option>
            <option value="轻微泛红">🌸 轻微泛红(已涂护臀膏)</option>
            <option value="红屁屁明显">🚨 红屁屁明显</option>
          </select>
        </div>
      </div>
    `;
  } else if (cat === 'jaundice') {
    box.innerHTML = `
      <div class="form-row">
        <div class="form-group">
          <label>额头测量值 (mg/dL)</label>
          <input type="number" step="0.1" id="j_forehead" class="form-input" value="9.5" oninput="syncJaundiceAvg()" required />
        </div>
        <div class="form-group">
          <label>胸口测量值 (mg/dL)</label>
          <input type="number" step="0.1" id="j_chest" class="form-input" value="9.0" oninput="syncJaundiceAvg()" required />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>综合记录黄疸值 (mg/dL)</label>
          <input type="number" step="0.1" id="j_valueMgDl" class="form-input" value="9.3" oninput="syncUmolFromMg()" required />
        </div>
        <div class="form-group">
          <label>对应医院单位 (μmol/L，可双向输入)</label>
          <input type="number" step="1" id="j_valueUmol" class="form-input" value="159" oninput="syncMgFromUmol()" />
        </div>
      </div>

      <div class="form-group">
        <label>当前退黄护理方式</label>
        <select id="j_therapyStatus" class="form-select">
          <option value="居家观察">🏠 居家观察（多吃多排）</option>
          <option value="晒太阳+多吃多排">🌞 隔窗柔和晒太阳 + 多吃多排</option>
          <option value="蓝光治疗中">💡 医院/居家照蓝光治疗中</option>
          <option value="医院门诊复查">🏥 医院门诊抽血/经皮复查</option>
        </select>
      </div>
    `;
  } else if (cat === 'sleep') {
    const defaultDur = prefill.durationMin || 120;
    box.innerHTML = `
      <div class="form-group">
        <label>本次睡眠时长 (分钟)</label>
        <input type="number" id="s_durationMin" class="form-input" value="${defaultDur}" min="5" max="720" step="5" required />
        <div class="preset-chips">
          ${[30, 60, 90, 120, 150, 180, 240].map(m =>
            `<span class="preset-chip" onclick="document.getElementById('s_durationMin').value=${m}">${m/60}小时(${m}分)</span>`
          ).join('')}
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>入睡方式</label>
          <select id="s_sootheMethod" class="form-select">
            <option value="奶睡">🍼 吃完奶睡着</option>
            <option value="自主入睡">✨ 放床自主入睡</option>
            <option value="抱睡/拍睡">🤱 抱睡 / 轻拍哄睡</option>
            <option value="襁褓/安抚奶嘴">🍬 襁褓包巾 / 安抚奶嘴</option>
          </select>
        </div>
        <div class="form-group">
          <label>睡眠质量</label>
          <select id="s_sleepQuality" class="form-select">
            <option value="安稳香甜">😴 安稳香甜</option>
            <option value="偶有惊跳">🦋 偶有惊跳反射</option>
            <option value="哼唧易醒">😣 频繁哼唧/使劲</option>
          </select>
        </div>
      </div>
    `;
  } else if (cat === 'growth') {
    const curW = getLatestWeight();
    box.innerHTML = `
      <div class="form-row">
        <div class="form-group">
          <label>⚖️ 体重 (kg)</label>
          <input type="number" step="0.01" id="g_weightKg" class="form-input" value="${curW}" required />
        </div>
        <div class="form-group">
          <label>🌡️ 体温 (°C)</label>
          <input type="number" step="0.1" id="g_tempC" class="form-input" value="36.8" required />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>📏 身长 (cm)</label>
          <input type="number" step="0.1" id="g_lengthCm" class="form-input" value="51.0" />
        </div>
        <div class="form-group">
          <label>🧢 头围 (cm)</label>
          <input type="number" step="0.1" id="g_headCm" class="form-input" value="34.5" />
        </div>
      </div>
    `;
  } else if (cat === 'care') {
    box.innerHTML = `
      <div class="form-group">
        <label>💊 维生素快捷选择（点击一键填入）</label>
        <div class="pill-selector" style="margin-bottom:10px;">
          <button type="button" class="pill-option selected" onclick="selectCareQuick(this, '☀️ 补充维生素 D3 (400IU)')">☀️ 维生素 D3 (400IU)</button>
          <button type="button" class="pill-option" onclick="selectCareQuick(this, '💧 补充维生素 AD (1粒)')">💧 维生素 AD (1粒)</button>
          <button type="button" class="pill-option" onclick="selectCareQuick(this, '🩸 补充维生素 K1 (滴剂/口服)')">🩸 维生素 K1</button>
          <button type="button" class="pill-option" onclick="selectCareQuick(this, '☀️ 维生素 D3 + 🩸 维生素 K1')">☀️+🩸 D3 + K1 同服</button>
          <button type="button" class="pill-option" onclick="selectCareQuick(this, '💧 维生素 AD + 🩸 维生素 K1')">💧+🩸 AD + K1 同服</button>
        </div>
      </div>

      <div class="form-group">
        <label>护理项目或成长里程碑名称（可自由修改）</label>
        <input type="text" id="c_careItem" class="form-input" value="☀️ 补充维生素 D3 (400IU)" required />
        <div class="preset-chips" style="margin-top:8px;">
          ${[
            '🥛 补充乳糖酶',
            '🦠 补充益生菌',
            '🐟 补充 DHA',
            '🩸 补充铁剂',
            '🌿 肚脐碘伏消毒护理',
            '🛁 温水洗澡 + 抚触按摩',
            '🧼 洗脸 / 鼻清洁 / 剪指甲',
            '🌞 晒太阳退黄 (15分钟)',
            '🍑 涂护臀膏 / 晾屁屁',
            '🎊 肚脐自然脱落啦！',
            '💉 接种乙肝疫苗 / 卡介苗',
            '😊 第一次对爸爸妈妈微笑'
          ].map(tag =>
            `<span class="preset-chip" onclick="selectCareQuick(null, '${tag}')">${tag}</span>`
          ).join('')}
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label>服用剂量 / 规格</label>
          <select id="c_careDosage" class="form-select">
            <option value="1粒 / 标准剂量">💊 1粒 / 标准剂量</option>
            <option value="400 IU">☀️ 400 IU (D3标准量)</option>
            <option value="1滴 / 2mg (K1)">🩸 1滴 / 2mg (维生素K1)</option>
            <option value="1支 / 医嘱剂量">💧 1支 / 按医嘱剂量</option>
            <option value="日常护理">✨ 日常护理 (非服药)</option>
          </select>
        </div>
        <div class="form-group">
          <label>喂服 / 护理方式</label>
          <select id="c_careMethod" class="form-select">
            <option value="直接滴入口中">👄 剪开胶囊直接滴入口中</option>
            <option value="滴在乳头/奶嘴上吸吮">🍼 滴在乳头/奶嘴上吸吮</option>
            <option value="混入少量奶液喂服">🥄 混入少量奶液/小勺喂服</option>
            <option value="医院肌注/门诊">🏥 医院门诊/肌注</option>
            <option value="居家外用护理">🏠 居家外用/日常护理</option>
          </select>
        </div>
      </div>
    `;
  }
}

function selectCareQuick(btn, textVal) {
  document.getElementById('c_careItem').value = textVal;
  if (btn && btn.parentElement) {
    btn.parentElement.querySelectorAll('.pill-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }
  const dosageEl = document.getElementById('c_careDosage');
  const methodEl = document.getElementById('c_careMethod');
  if (dosageEl && methodEl) {
    if (textVal.includes('K1') && !textVal.includes('D3') && !textVal.includes('AD')) {
      dosageEl.value = '1滴 / 2mg (K1)';
    } else if (textVal.includes('D3') && !textVal.includes('AD')) {
      dosageEl.value = '400 IU';
    } else if (textVal.includes('AD')) {
      dosageEl.value = '1粒 / 标准剂量';
    } else if (!textVal.includes('维生素')) {
      dosageEl.value = '日常护理';
      methodEl.value = '居家外用护理';
    }
  }
}

function selectPill(btn, hiddenInputId, val) {
  document.getElementById(hiddenInputId).value = val;
  btn.parentElement.querySelectorAll('.pill-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function selectSwatch(el, hiddenInputId, val) {
  document.getElementById(hiddenInputId).value = val;
  el.parentElement.querySelectorAll('.poop-swatch').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

function syncJaundiceAvg() {
  const fh = parseFloat(document.getElementById('j_forehead').value) || 0;
  const ch = parseFloat(document.getElementById('j_chest').value) || 0;
  const avg = +((fh + ch) / 2).toFixed(1);
  document.getElementById('j_valueMgDl').value = avg;
  document.getElementById('j_valueUmol').value = Math.round(avg * 17.1);
}

function syncUmolFromMg() {
  const mg = parseFloat(document.getElementById('j_valueMgDl').value) || 0;
  document.getElementById('j_valueUmol').value = Math.round(mg * 17.1);
}

function syncMgFromUmol() {
  const umol = parseFloat(document.getElementById('j_valueUmol').value) || 0;
  const mg = +(umol / 17.1).toFixed(1);
  document.getElementById('j_valueMgDl').value = mg;
}

async function submitRecordForm(e) {
  e.preventDefault();
  const timestamp = document.getElementById('recordTimestamp').value || toDateTimeLocalStr(new Date());
  const note = document.getElementById('recordNote').value.trim();

  const rec = {
    id: uid(),
    category: currentModalCategory,
    timestamp,
    note
  };

  if (currentModalCategory === 'feed') {
    rec.feedType = document.getElementById('f_feedType').value;
    rec.amountMl = Number(document.getElementById('f_amountMl').value) || 0;
    rec.leftMin = Number(document.getElementById('f_leftMin').value) || 0;
    rec.rightMin = Number(document.getElementById('f_rightMin').value) || 0;
    rec.burped = document.getElementById('f_burped').value;
    rec.spitUp = document.getElementById('f_spitUp').value;
  } else if (currentModalCategory === 'diaper') {
    rec.diaperType = document.getElementById('d_diaperType').value;
    rec.poopColor = rec.diaperType === 'wet' ? '' : document.getElementById('d_poopColor').value;
    rec.poopTexture = rec.diaperType === 'wet' ? '' : document.getElementById('d_poopTexture').value;
    rec.rashStatus = document.getElementById('d_rashStatus').value;
    rec.amountLevel = '适中';
  } else if (currentModalCategory === 'jaundice') {
    rec.forehead = Number(document.getElementById('j_forehead').value) || 0;
    rec.chest = Number(document.getElementById('j_chest').value) || 0;
    rec.valueMgDl = Number(document.getElementById('j_valueMgDl').value) || 0;
    rec.therapyStatus = document.getElementById('j_therapyStatus').value;
  } else if (currentModalCategory === 'sleep') {
    rec.durationMin = Number(document.getElementById('s_durationMin').value) || 60;
    rec.sootheMethod = document.getElementById('s_sootheMethod').value;
    rec.sleepQuality = document.getElementById('s_sleepQuality').value;
  } else if (currentModalCategory === 'growth') {
    rec.weightKg = Number(document.getElementById('g_weightKg').value) || 0;
    rec.tempC = Number(document.getElementById('g_tempC').value) || 36.8;
    rec.lengthCm = Number(document.getElementById('g_lengthCm').value) || 0;
    rec.headCm = Number(document.getElementById('g_headCm').value) || 0;
  } else if (currentModalCategory === 'care') {
    rec.careItem = document.getElementById('c_careItem').value.trim();
    const dosage = document.getElementById('c_careDosage') ? document.getElementById('c_careDosage').value : '';
    const method = document.getElementById('c_careMethod') ? document.getElementById('c_careMethod').value : '';
    if (dosage && dosage !== '日常护理') {
      rec.note = [ `${dosage} · ${method}`, rec.note ].filter(Boolean).join(' | ');
    }
    // 自动同步勾选对应日期的必做护理打卡清单
    const recDateStr = (rec.timestamp || '').slice(0, 10);
    if (recDateStr) {
      if (!appState.dailyChecklist[recDateStr]) appState.dailyChecklist[recDateStr] = {};
      const upper = rec.careItem.toUpperCase();
      if (upper.includes('D3')) appState.dailyChecklist[recDateStr].vd3 = true;
      if (upper.includes('AD')) appState.dailyChecklist[recDateStr].vad = true;
      if (upper.includes('K1')) appState.dailyChecklist[recDateStr].vk1 = true;
      if (upper.includes('肚脐')) appState.dailyChecklist[recDateStr].cord = true;
      if (upper.includes('洗澡')) appState.dailyChecklist[recDateStr].bath = true;
    }
  }

  appState.records.unshift(rec);
  await persistState();
  closeRecordModal();
  renderAll();
  showToast('🍬 已成功保存宝宝记录！');
}

// ============================================================================
// 9. 宝宝档案设置弹窗
// ============================================================================
function openProfileModal() {
  const p = appState.profile;
  document.getElementById('profName').value = p.name || '小糖果';
  document.getElementById('profGender').value = p.gender || 'girl';
  document.getElementById('profBirth').value = p.birthDateTime || toDateTimeLocalStr(new Date());
  document.getElementById('profBirthWeight').value = p.birthWeight || 3.25;
  document.getElementById('profBirthLength').value = p.birthLength || 50.0;
  document.getElementById('profFeedInterval').value = p.feedIntervalHours || 3;
  document.getElementById('profMilkFactor').value = p.milkFactor || 150;
  document.getElementById('profileModalBackdrop').classList.add('open');
}

function closeProfileModal() {
  document.getElementById('profileModalBackdrop').classList.remove('open');
}

async function saveProfileForm(e) {
  e.preventDefault();
  appState.profile = {
    name: document.getElementById('profName').value.trim() || '小糖果',
    gender: document.getElementById('profGender').value,
    birthDateTime: document.getElementById('profBirth').value,
    birthWeight: Number(document.getElementById('profBirthWeight').value) || 3.25,
    birthLength: Number(document.getElementById('profBirthLength').value) || 50.0,
    feedIntervalHours: Number(document.getElementById('profFeedInterval').value) || 3,
    milkFactor: Number(document.getElementById('profMilkFactor').value) || 150
  };
  await persistState();
  closeProfileModal();
  renderAll();
  showToast('💖 宝宝档案已更新！');
}

// ============================================================================
// 10. 实时喂奶 / 睡眠秒表计时器
// ============================================================================
function formatClockHMS(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function toggleLiveTimer(mode) {
  if (liveTimer.running && liveTimer.mode === mode) {
    // 暂停当前计时
    clearInterval(liveTimer.intervalId);
    liveTimer.running = false;
    updateTimerUI();
    return;
  }

  if (liveTimer.intervalId) clearInterval(liveTimer.intervalId);
  liveTimer.mode = mode;
  liveTimer.running = true;

  liveTimer.intervalId = setInterval(() => {
    liveTimer.seconds++;
    if (liveTimer.mode === 'left') liveTimer.leftSeconds++;
    if (liveTimer.mode === 'right') liveTimer.rightSeconds++;
    updateTimerUI();
  }, 1000);

  updateTimerUI();
}

function updateTimerUI() {
  document.getElementById('liveTimerDisplay').textContent = formatClockHMS(liveTimer.seconds);
  document.getElementById('timerBtnLeft').classList.toggle('active', liveTimer.running && liveTimer.mode === 'left');
  document.getElementById('timerBtnRight').classList.toggle('active', liveTimer.running && liveTimer.mode === 'right');
  document.getElementById('timerBtnSleep').classList.toggle('active', liveTimer.running && liveTimer.mode === 'sleep');

  const finishBtn = document.getElementById('timerFinishBtn');
  finishBtn.style.display = liveTimer.seconds > 0 ? 'block' : 'none';

  const titleEl = document.getElementById('timerModeTitle');
  if (liveTimer.seconds === 0) {
    titleEl.textContent = '🤱 选择计时项目（解放双手）';
  } else if (liveTimer.mode === 'sleep') {
    titleEl.textContent = liveTimer.running ? '💤 正在记录宝宝睡眠...' : '⏸️ 睡眠计时已暂停';
  } else {
    const lMin = Math.ceil(liveTimer.leftSeconds / 60);
    const rMin = Math.ceil(liveTimer.rightSeconds / 60);
    titleEl.textContent = `🤱 亲喂中 (左:${lMin}分 / 右:${rMin}分)`;
  }
}

function resetLiveTimer() {
  if (liveTimer.intervalId) clearInterval(liveTimer.intervalId);
  liveTimer = { running: false, mode: null, seconds: 0, leftSeconds: 0, rightSeconds: 0, intervalId: null };
  updateTimerUI();
}

function finishAndSaveTimer() {
  const mode = liveTimer.mode;
  const totalMin = Math.max(1, Math.round(liveTimer.seconds / 60));
  const leftMin = Math.max(0, Math.round(liveTimer.leftSeconds / 60));
  const rightMin = Math.max(0, Math.round(liveTimer.rightSeconds / 60));
  resetLiveTimer();

  if (mode === 'sleep') {
    openRecordModal('sleep', { durationMin: totalMin, note: '通过实时睡眠计时器记录' });
  } else {
    openRecordModal('feed', {
      feedType: 'nursing',
      amountMl: 0,
      leftMin: leftMin || totalMin,
      rightMin,
      note: '通过实时亲喂秒表记录'
    });
  }
}

// ============================================================================
// 11. 导出 Excel(CSV) / JSON 备份与恢复
// ============================================================================
function exportCSV() {
  const headers = ['时间', '类别', '喂养类型/尿布类型', '奶量(ml)', '左亲喂(分)', '右亲喂(分)', '便便颜色', '便便性状', '黄疸值(mg/dL)', '睡眠时长(分)', '体重(kg)', '体温(°C)', '护理项', '备注'];
  const rows = appState.records.map(r => [
    r.timestamp ? r.timestamp.replace('T', ' ') : '',
    r.category,
    r.feedType || r.diaperType || '',
    r.amountMl ?? '',
    r.leftMin ?? '',
    r.rightMin ?? '',
    r.poopColor || '',
    r.poopTexture || '',
    r.valueMgDl ?? '',
    r.durationMin ?? '',
    r.weightKg ?? '',
    r.tempC ?? '',
    r.careItem || '',
    (r.note || '').replace(/,/g, '，')
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${appState.profile.name || '宝宝'}_成长护理记录_${toLocalDateStr(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📊 已导出 Excel (CSV) 表格！');
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `candy_baby_backup_${toLocalDateStr(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('💾 已下载完整数据备份文件！');
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed && Array.isArray(parsed.records)) {
        appState = parsed;
        await persistState();
        renderAll();
        showToast('🎉 数据导入恢复成功！');
      } else {
        alert('文件格式不正确，请选择有效的备份 JSON 文件。');
      }
    } catch (err) {
      alert('读取备份文件失败：' + err.message);
    }
  };
  reader.readAsText(file);
}

function showToast(msg) {
  const t = document.getElementById('candyToast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ============================================================================
// 12. 家庭多端 GitHub 云端同步引擎（支持多部手机记录级无冲突自动合并）
// ============================================================================
let isCloudSyncing = false;

function getCloudConfig() {
  try {
    const raw = localStorage.getItem(CLOUD_CFG_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    if (cfg && cfg.owner && cfg.repo && cfg.token) {
      // 自动将数据仓库指向 100% 私有的 03-Baby-Private，确保宝宝数据绝不公开
      if (cfg.repo === '03-Baby') {
        cfg.repo = '03-Baby-Private';
        localStorage.setItem(CLOUD_CFG_KEY, JSON.stringify(cfg));
      }
      return cfg;
    }
  } catch (e) {}
  return null;
}

function checkUrlSyncPairing() {
  try {
    const params = new URLSearchParams(window.location.search);
    const syncKey = params.get('sync_key');
    if (syncKey) {
      const jsonStr = decodeURIComponent(escape(atob(syncKey)));
      const cfg = JSON.parse(jsonStr);
      if (cfg && cfg.owner && cfg.repo && cfg.token) {
        if (cfg.repo === '03-Baby') cfg.repo = '03-Baby-Private';
        localStorage.setItem(CLOUD_CFG_KEY, JSON.stringify(cfg));
        // 清除地址栏中的敏感参数，保护 Token 安全
        window.history.replaceState({}, document.title, window.location.pathname);
        setTimeout(() => showToast('🎉 家庭私有云同步配对成功！正在拉取宝宝数据...'), 400);
      }
    }
  } catch (e) {
    console.warn('解析同步链接失败', e);
  }
}

function updateCloudSyncHeaderUI(statusText = null) {
  const btn = document.getElementById('cloudSyncHeaderBtn');
  const refreshBtn = document.getElementById('cloudRefreshBtn');
  const shareBox = document.getElementById('cloudShareBox');
  if (!btn) return;

  const cfg = getCloudConfig();
  if (!cfg) {
    btn.textContent = '☁️ 家庭云同步: 未开启';
    btn.className = 'btn btn-pink btn-sm';
    if (refreshBtn) refreshBtn.style.display = 'none';
    if (shareBox) shareBox.style.display = 'none';
  } else {
    btn.textContent = statusText || `🟢 云端已连接 (${cfg.repo})`;
    btn.className = 'btn btn-mint btn-sm';
    if (refreshBtn) refreshBtn.style.display = 'inline-flex';
    if (shareBox) shareBox.style.display = 'block';
  }
}

function openCloudSyncModal() {
  const cfg = getCloudConfig();
  let defaultOwner = 'emojojo';
  let defaultRepo = '03-Baby-Private';
  if (window.location.hostname.endsWith('.github.io')) {
    defaultOwner = window.location.hostname.split('.')[0];
  }

  document.getElementById('cloudOwner').value = (cfg && cfg.owner) || defaultOwner;
  document.getElementById('cloudRepo').value = (cfg && cfg.repo) || defaultRepo;
  document.getElementById('cloudToken').value = (cfg && cfg.token) || '';
  document.getElementById('cloudBranch').value = (cfg && cfg.branch) || 'main';

  const shareBox = document.getElementById('cloudShareBox');
  if (shareBox) shareBox.style.display = cfg ? 'block' : 'none';

  document.getElementById('cloudSyncModalBackdrop').classList.add('open');
}

function closeCloudSyncModal() {
  document.getElementById('cloudSyncModalBackdrop').classList.remove('open');
}

async function saveCloudSyncForm(e) {
  e.preventDefault();
  const cfg = {
    owner: document.getElementById('cloudOwner').value.trim(),
    repo: document.getElementById('cloudRepo').value.trim(),
    token: document.getElementById('cloudToken').value.trim(),
    branch: document.getElementById('cloudBranch').value.trim() || 'main'
  };
  localStorage.setItem(CLOUD_CFG_KEY, JSON.stringify(cfg));
  updateCloudSyncHeaderUI('🔄 正在连接云端...');

  const ok = await syncWithGitHubCloud(true);
  if (ok) {
    document.getElementById('cloudShareBox').style.display = 'block';
    showToast('☁️ 家庭云端同步已打通！可复制专属链接发给家人啦！');
  }
}

function disableCloudSync() {
  localStorage.removeItem(CLOUD_CFG_KEY);
  updateCloudSyncHeaderUI();
  closeCloudSyncModal();
  showToast('已停用家庭云同步，当前仅保存在本机');
}

function copyFamilyShareLink() {
  const cfg = getCloudConfig();
  if (!cfg) {
    alert('请先填写并保存云同步设置！');
    return;
  }
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
  let baseUrl = `${window.location.origin}${window.location.pathname}`;
  if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
    baseUrl = `https://${cfg.owner}.github.io/03-Baby/`;
  }
  const inviteUrl = `${baseUrl}?sync_key=${encodeURIComponent(encoded)}`;
  navigator.clipboard.writeText(inviteUrl).then(() => {
    showToast('📲 家人一键同步专属链接已复制！快发到家庭微信群吧！');
  }).catch(() => {
    prompt('请复制以下家人专属配对链接发到微信：', inviteUrl);
  });
}

async function manualCloudPull() {
  showToast('🔄 正在从云端同步家人最新记录...');
  const ok = await syncWithGitHubCloud(false);
  if (ok) showToast('✨ 已同步到最新家庭记录！');
}

// 智能记录级合并：防止爸爸和妈妈同时记录时互相覆盖
function mergeBabyStates(local, remote) {
  if (!remote || !Array.isArray(remote.records)) return local;

  // 若本地还是初始演示数据，而云端已经是真实宝宝数据，直接以云端为准
  if (local.isDemo && remote.isDemo === false) {
    return remote;
  }
  if (remote.isDemo && local.isDemo === false) {
    return local;
  }

  const deletedSet = new Set([
    ...(local.deletedIds || []),
    ...(remote.deletedIds || [])
  ]);

  const isRealMode = local.isDemo === false || remote.isDemo === false;
  const demoIdPattern = /_-?\d+_(f|d|j|s|g|c)\d*$/;

  const recordMap = new Map();
  [...(remote.records || []), ...(local.records || [])].forEach(r => {
    if (r && r.id && !deletedSet.has(r.id)) {
      if (isRealMode && demoIdPattern.test(r.id)) return; // 自动剔除虚拟演示数据
      recordMap.set(r.id, r);
    }
  });

  const mergedRecords = Array.from(recordMap.values()).sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  // 合并每日护理打卡
  const mergedChecklist = { ...(remote.dailyChecklist || {}) };
  Object.keys(local.dailyChecklist || {}).forEach(day => {
    mergedChecklist[day] = {
      ...(mergedChecklist[day] || {}),
      ...(local.dailyChecklist[day] || {})
    };
  });

  const localNewer = (local.updatedAt || 0) >= (remote.updatedAt || 0);

  return {
    isDemo: localNewer ? local.isDemo : remote.isDemo,
    updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0, Date.now()),
    deletedIds: Array.from(deletedSet).slice(-500),
    profile: localNewer ? local.profile : (remote.profile || local.profile),
    records: mergedRecords,
    dailyChecklist: mergedChecklist
  };
}

async function syncWithGitHubCloud(pushLocal = false, silent = false) {
  const cfg = getCloudConfig();
  if (!cfg || isCloudSyncing) return false;

  isCloudSyncing = true;
  if (!silent) updateCloudSyncHeaderUI('🔄 云端同步中...');

  const apiUrl = `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/data/baby_data.json`;
  const headers = {
    'Authorization': `Bearer ${cfg.token}`,
    'Accept': 'application/vnd.github+json'
  };

  try {
    // 1. 拉取云端最新的 data/baby_data.json 和它的 sha
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(cfg.branch)}&_t=${Date.now()}`, {
      headers,
      cache: 'no-store'
    });

    let remoteSha = null;
    let remoteState = null;

    if (getRes.status === 200) {
      const fileInfo = await getRes.json();
      remoteSha = fileInfo.sha;
      if (fileInfo.content) {
        const cleanBase64 = fileInfo.content.replace(/\s/g, '');
        const jsonStr = decodeURIComponent(escape(atob(cleanBase64)));
        remoteState = JSON.parse(jsonStr);
      }
    } else if (getRes.status !== 404) {
      throw new Error(`GitHub API 状态码 ${getRes.status}，请检查仓库名或 Token 权限`);
    }

    // 2. 与本地记录进行无损合并
    if (remoteState) {
      appState = mergeBabyStates(appState, remoteState);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
      renderAll();
    }

    // 3. 如果需要推送更新（或者云端还没有 data/baby_data.json 文件），写回 GitHub
    if (pushLocal || !remoteSha) {
      const contentStr = JSON.stringify(appState, null, 2);
      const base64Content = btoa(unescape(encodeURIComponent(contentStr)));
      const body = {
        message: `🍼 更新宝宝成长记录 (${new Date().toLocaleString('zh-CN')})`,
        content: base64Content,
        branch: cfg.branch
      };
      if (remoteSha) body.sha = remoteSha;

      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!putRes.ok) {
        throw new Error(`写入云端失败 (${putRes.status})`);
      }
    }

    const nowHM = formatTimeHM(new Date().toISOString());
    updateCloudSyncHeaderUI(`🟢 云同步已连接 (${nowHM})`);
    isCloudSyncing = false;
    return true;
  } catch (err) {
    console.warn('GitHub 云端同步异常:', err);
    updateCloudSyncHeaderUI('⚠️ 云同步失败 (点击检查)');
    if (!silent) {
      alert('连接 GitHub 云端失败：' + err.message + '\n请确认：\n1. GitHub 上已创建该仓库\n2. Token 勾选了 repo (或 Contents Read & Write) 权限');
    }
    isCloudSyncing = false;
    return false;
  }
}

// 启动应用
window.addEventListener('DOMContentLoaded', initApp);
