const { SSQ_HISTORY, DLT_HISTORY, DATA_UPDATED_AT } = require('./lottery-data');

// 玩法配置：main 为主区（红球/前区），extra 为副区（蓝球/后区）
const GAMES = {
    ssq: {
        key: 'ssq',
        name: '双色球',
        history: SSQ_HISTORY,
        drawInfo: '每周二、四、日 21:15 开奖',
        groups: [
            { key: 'main', label: '红球', min: 1, max: 33, count: 6, color: 'red' },
            { key: 'extra', label: '蓝球', min: 1, max: 16, count: 1, color: 'blue' },
        ],
    },
    dlt: {
        key: 'dlt',
        name: '大乐透',
        history: DLT_HISTORY,
        drawInfo: '每周一、三、六 21:25 开奖',
        groups: [
            { key: 'main', label: '前区', min: 1, max: 35, count: 5, color: 'red' },
            { key: 'extra', label: '后区', min: 1, max: 12, count: 2, color: 'blue' },
        ],
    },
};

// 选号模式
const MODES = [
    { key: 'random', name: '均衡机选', desc: '每个号码被选中概率相同' },
    { key: 'hot', name: '热号倾向', desc: '近 50 期出现次数越多，权重越高' },
    { key: 'cold', name: '冷号倾向', desc: '遗漏期数越多，权重越高' },
];

const NOTICE = '开奖为独立随机事件，任何历史数据都无法预测未来开奖结果。本工具生成的号码仅供娱乐参考，不构成任何投注建议。理性购彩，量力而行；未满 18 周岁禁止购买彩票。';

function getGame(key) {
    return GAMES[key] || GAMES.ssq;
}

function pad(n) {
    return n < 10 ? '0' + n : '' + n;
}

// 历史行统一为 [期号, 日期, 主区号码数组, 副区号码数组]
function getDrawView(row) {
    const mainNums = row[2];
    const extraNums = row[3];
    return {
        code: row[0],
        date: row[1],
        main: mainNums.map(pad),
        extra: extraNums.map(pad),
        mainNums: mainNums,
        extraNums: extraNums,
        sum: mainNums.reduce((a, b) => a + b, 0),
        odd: mainNums.filter(n => n % 2 === 1).length,
        even: mainNums.filter(n => n % 2 === 0).length,
    };
}

function latestDraw(game) {
    return getDrawView(game.history[0]);
}

function recentDraws(game, count) {
    return game.history.slice(0, count).map(getDrawView);
}

// 指定区号在近 windowSize 期的出现次数，返回 [{num, cnt, pct}]
function frequency(game, groupIdx, windowSize) {
    const cfg = game.groups[groupIdx];
    const counts = {};
    for (let n = cfg.min; n <= cfg.max; n += 1) {
        counts[n] = 0;
    }
    game.history.slice(0, windowSize).forEach((row) => {
        row[2 + groupIdx].forEach((n) => {
            counts[n] += 1;
        });
    });
    const list = [];
    for (let n = cfg.min; n <= cfg.max; n += 1) {
        list.push({
            num: n,
            cnt: counts[n],
            pct: Math.round((counts[n] / windowSize) * 100),
        });
    }
    return list;
}

// 指定区号当前遗漏期数（从最新一期往前数，多少期没出现），返回 [{num, miss}]
function omissions(game, groupIdx) {
    const cfg = game.groups[groupIdx];
    const total = game.history.length;
    const list = [];
    for (let n = cfg.min; n <= cfg.max; n += 1) {
        let miss = total;
        for (let i = 0; i < total; i += 1) {
            if (game.history[i][2 + groupIdx].indexOf(n) !== -1) {
                miss = i;
                break;
            }
        }
        list.push({ num: n, miss: miss });
    }
    return list;
}

// 加权无放回抽样，返回升序号码数组
function weightedSample(numbers, weights, count) {
    const pool = numbers.slice();
    const poolWeights = weights.slice();
    const picked = [];
    for (let k = 0; k < count; k += 1) {
        let total = 0;
        for (let i = 0; i < poolWeights.length; i += 1) {
            total += poolWeights[i];
        }
        let r = Math.random() * total;
        let hit = 0;
        for (let i = 0; i < poolWeights.length; i += 1) {
            r -= poolWeights[i];
            if (r <= 0) {
                hit = i;
                break;
            }
        }
        picked.push(pool[hit]);
        pool.splice(hit, 1);
        poolWeights.splice(hit, 1);
    }
    picked.sort((a, b) => a - b);
    return picked;
}

// 按模式从指定区抽取 count 个号码（供单式/复式共用）
function pickGroup(game, cfg, groupIdx, mode, count, freqWindow) {
    const freq = frequency(game, groupIdx, freqWindow);
    const om = omissions(game, groupIdx);
    const freqMap = {};
    freq.forEach((f) => { freqMap[f.num] = f.cnt; });
    const omMap = {};
    om.forEach((o) => { omMap[o.num] = o.miss; });

    const numbers = [];
    const weights = [];
    for (let n = cfg.min; n <= cfg.max; n += 1) {
        numbers.push(n);
        if (mode === 'hot') {
            weights.push(1 + (freqMap[n] || 0));
        } else if (mode === 'cold') {
            weights.push(1 + (omMap[n] || 0));
        } else {
            weights.push(1);
        }
    }
    return weightedSample(numbers, weights, count);
}

function resolveModeName(mode, modeName) {
    return modeName || (MODES.filter(m => m.key === mode)[0] || {}).name || '均衡机选';
}

// 按模式生成一注（单式）号码，返回供页面直接渲染的结构
function generateSet(game, mode, modeName) {
    const result = { mode: mode, modeName: resolveModeName(mode, modeName) };
    const freqWindow = Math.min(50, game.history.length);
    game.groups.forEach((cfg, groupIdx) => {
        const picked = pickGroup(game, cfg, groupIdx, mode, cfg.count, freqWindow);
        result[cfg.key + 'Nums'] = picked;
        result[cfg.key] = picked.map(pad);
    });
    return result;
}

// 复式投注：各区号码个数可超过单式（主区/副区至少一侧超出），返回完整号码集合
function generateMultiSet(game, mode, mainCount, extraCount, modeName) {
    const counts = [mainCount, extraCount];
    const result = {
        mode: mode,
        modeName: resolveModeName(mode, modeName),
        isMulti: true,
        mainCount: mainCount,
        extraCount: extraCount,
    };
    const freqWindow = Math.min(50, game.history.length);
    game.groups.forEach((cfg, groupIdx) => {
        const picked = pickGroup(game, cfg, groupIdx, mode, counts[groupIdx], freqWindow);
        result[cfg.key + 'Nums'] = picked;
        result[cfg.key] = picked.map(pad);
    });
    return result;
}

// 组合数 C(n, k)
function combination(n, k) {
    if (k < 0 || n < 0 || k > n) {
        return 0;
    }
    let result = 1;
    for (let i = 1; i <= k; i += 1) {
        result = result * (n - k + i) / i;
    }
    return Math.round(result);
}

// 复式注数 = 各选号区组合数之积（如双色球 7+2 = C(7,6)×C(2,1) = 14 注）
function multiBetCount(game, mainCount, extraCount) {
    return combination(mainCount, game.groups[0].count) * combination(extraCount, game.groups[1].count);
}

// 复式可选个数边界与单注价格（官方规则：双色球红 6-20/蓝 1-16；大乐透前区 5-20/后区 2-12）
const MULTI_BOUNDS = {
    ssq: { mainMin: 6, mainMax: 20, extraMin: 1, extraMax: 16, betPrice: 2 },
    dlt: { mainMin: 5, mainMax: 20, extraMin: 2, extraMax: 12, betPrice: 2 },
};

function getMultiBounds(gameKey) {
    return MULTI_BOUNDS[gameKey] || MULTI_BOUNDS.ssq;
}

module.exports = {
    GAMES,
    MODES,
    NOTICE,
    MULTI_BOUNDS,
    DATA_UPDATED_AT,
    getGame,
    getMultiBounds,
    pad,
    latestDraw,
    recentDraws,
    frequency,
    omissions,
    generateSet,
    generateMultiSet,
    combination,
    multiBetCount,
};
