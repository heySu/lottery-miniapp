// 选号记录本地存储：与 list-crud 骨架的 item-store 同构（list/create/remove），
// 记录字段为玩法、号码与生成模式，存储于手机本地。
const STORAGE_KEY = 'lottery_pick_records';

function createPickStore() {
    return {
        list() {
            return safely(() => ({ data: readItems(), error: null }));
        },

        create(payload) {
            return safely(() => {
                const source = payload && typeof payload === 'object' ? payload : {};
                const item = {
                    id: createItemId(Date.now()),
                    game: source.game || 'ssq',
                    gameName: source.gameName || '双色球',
                    mode: source.mode || 'random',
                    modeName: source.modeName || '均衡机选',
                    main: Array.isArray(source.main) ? source.main : [],
                    extra: Array.isArray(source.extra) ? source.extra : [],
                    createdAt: Date.now(),
                };
                // 复式投注附加字段：注数与金额
                if (source.isMulti) {
                    item.isMulti = true;
                    item.betCount = Number(source.betCount) || 0;
                    item.amount = Number(source.amount) || 0;
                }
                if (item.main.length === 0) {
                    return { data: null, error: { code: 'INVALID_PAYLOAD', message: '没有可保存的号码' } };
                }
                const items = readItems();
                items.unshift(item);
                writeItems(items);
                return { data: item, error: null };
            });
        },

        remove(id) {
            return safely(() => {
                const itemId = String(id);
                const items = readItems();
                const filtered = items.filter(item => item.id !== itemId);
                if (filtered.length === items.length) {
                    return { data: null, error: { code: 'NOT_FOUND_OR_FORBIDDEN', message: '记录不存在或已删除' } };
                }
                writeItems(filtered);
                return { data: { removed: 1 }, error: null };
            });
        },

        clearAll() {
            return safely(() => {
                writeItems([]);
                return { data: { removed: -1 }, error: null };
            });
        },
    };
}

function safely(executor) {
    return Promise.resolve()
        .then(executor)
        .catch((error) => ({
            data: null,
            error: {
                code: 'CLIENT_EXCEPTION',
                message: error && error.message ? error.message : '本地存储读写异常',
            },
        }));
}

function readItems() {
    const value = wx.getStorageSync(STORAGE_KEY);
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter(item => item !== null
        && typeof item === 'object'
        && typeof item.id === 'string'
        && Array.isArray(item.main)
        && Array.isArray(item.extra));
}

function writeItems(items) {
    wx.setStorageSync(STORAGE_KEY, items);
}

let idCounter = 0;

function createItemId(timestamp) {
    idCounter = (idCounter + 1) % 1000000;
    return String(timestamp) + '-' + String(idCounter);
}

module.exports = createPickStore();
