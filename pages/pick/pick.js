const {
    getGame,
    generateSet,
    generateMultiSet,
    multiBetCount,
    getMultiBounds,
    MODES,
    NOTICE,
} = require('../../utils/lottery');
const pickStore = require('../../utils/pick-store');
const { applyTab } = require('../../utils/tab-helper');

// 复式默认个数：双色球 7+2（14 注 28 元）、大乐透 6+3（18 注 36 元）
const MULTI_DEFAULTS = {
    ssq: { mainCount: 7, extraCount: 2 },
    dlt: { mainCount: 6, extraCount: 3 },
};

function createMultiState(gameKey) {
    const game = getGame(gameKey);
    const bounds = getMultiBounds(gameKey);
    const defaults = MULTI_DEFAULTS[gameKey] || MULTI_DEFAULTS.ssq;
    return buildMultiState(game, bounds, defaults.mainCount, defaults.extraCount);
}

function buildMultiState(game, bounds, mainCount, extraCount) {
    const baseMain = game.groups[0].count;
    const baseExtra = game.groups[1].count;
    // 复式要求主区/副区至少一侧超过单式个数，否则退化为单式
    const isMultiCombo = mainCount > baseMain || extraCount > baseExtra;
    const betCount = isMultiCombo ? multiBetCount(game, mainCount, extraCount) : 0;
    return {
        mainCount: mainCount,
        extraCount: extraCount,
        mainMin: bounds.mainMin,
        mainMax: bounds.mainMax,
        extraMin: bounds.extraMin,
        extraMax: bounds.extraMax,
        betPrice: bounds.betPrice,
        mainLabel: game.groups[0].label,
        extraLabel: game.groups[1].label,
        betCount: betCount,
        amount: betCount * bounds.betPrice,
        canMinusMain: mainCount > bounds.mainMin && (mainCount - 1 > baseMain || extraCount > baseExtra),
        canPlusMain: mainCount < bounds.mainMax,
        canMinusExtra: extraCount > bounds.extraMin && (mainCount > baseMain || extraCount - 1 > baseExtra),
        canPlusExtra: extraCount < bounds.extraMax,
    };
}

Page({
    data: {
        gameKey: 'ssq',
        gameName: '双色球',
        modes: MODES,
        mode: 'random',
        playType: 'single',
        countOptions: [1, 2, 3, 4, 5],
        count: 1,
        results: [],
        hasResult: false,
        generating: false,
        notice: NOTICE,
        multi: null,
    },

    onLoad() {
        this.applyGame('ssq');
    },

    onShow() {
        applyTab(this);
    },

    applyGame(key) {
        const game = getGame(key);
        this.setData({
            gameKey: game.key,
            gameName: game.name,
            results: [],
            hasResult: false,
            multi: createMultiState(game.key),
        });
    },

    switchGame(event) {
        this.applyGame(event.currentTarget.dataset.game);
    },

    switchPlay(event) {
        this.setData({ playType: event.currentTarget.dataset.type, results: [], hasResult: false });
    },

    selectMode(event) {
        this.setData({ mode: event.currentTarget.dataset.mode });
    },

    setCount(event) {
        this.setData({ count: Number(event.currentTarget.dataset.count) });
    },

    changeMainCount(event) {
        this.adjustMulti(Number(event.currentTarget.dataset.delta), 0);
    },

    changeExtraCount(event) {
        this.adjustMulti(0, Number(event.currentTarget.dataset.delta));
    },

    adjustMulti(deltaMain, deltaExtra) {
        const current = this.data.multi;
        const game = getGame(this.data.gameKey);
        const bounds = getMultiBounds(this.data.gameKey);
        const mainCount = Math.max(bounds.mainMin, Math.min(bounds.mainMax, current.mainCount + deltaMain));
        const extraCount = Math.max(bounds.extraMin, Math.min(bounds.extraMax, current.extraCount + deltaExtra));
        // 复式要求主区/副区至少一侧超过单式个数，防止退化成单式
        if (mainCount <= game.groups[0].count && extraCount <= game.groups[1].count) {
            wx.showToast({ title: '主区或副区至少一侧需超过单式个数', icon: 'none' });
            return;
        }
        this.setData({ multi: buildMultiState(game, bounds, mainCount, extraCount) });
    },

    generate() {
        if (this.data.generating) {
            return;
        }
        this.setData({ generating: true });
        const game = getGame(this.data.gameKey);
        const results = [];
        if (this.data.playType === 'multi') {
            const m = this.data.multi;
            const set = generateMultiSet(game, this.data.mode, m.mainCount, m.extraCount);
            set.sn = 'pick-' + Date.now() + '-0';
            set.betCount = m.betCount;
            set.amount = m.amount;
            set.multiLabel = m.mainLabel + ' ' + m.mainCount + ' + ' + m.extraLabel + ' ' + m.extraCount;
            results.push(set);
        } else {
            for (let i = 0; i < this.data.count; i += 1) {
                const set = generateSet(game, this.data.mode);
                set.sn = 'pick-' + Date.now() + '-' + i;
                results.push(set);
            }
        }
        this.setData({
            results: results,
            hasResult: true,
            generating: false,
        });
    },

    saveResult(event) {
        const index = event.currentTarget.dataset.index;
        const target = this.data.results[index];
        if (!target) {
            return;
        }
        pickStore.create({
            game: this.data.gameKey,
            gameName: this.data.gameName,
            mode: target.mode,
            modeName: target.modeName,
            main: target.mainNums,
            extra: target.extraNums,
            isMulti: !!target.isMulti,
            betCount: target.betCount || 0,
            amount: target.amount || 0,
        }).then((res) => {
            if (res.error) {
                wx.showToast({ title: '保存失败', icon: 'none' });
            } else {
                wx.showToast({ title: '已保存到记录', icon: 'success' });
            }
        });
    },
});
