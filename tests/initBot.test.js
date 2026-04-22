import { describe, it, expect, beforeEach } from 'vitest';
import RiveScript from 'rivescript';

// Make RiveScript available globally so initBot can find it
globalThis.RiveScript = RiveScript;

const app = require('../app.js');

describe('initBot', () => {
    beforeEach(() => {
        app.bot = null;
        app.currentLang = 'vi';
        document.body.innerHTML = '<div id="message-display"></div>';
    });

    it('should create a RiveScript instance for Vietnamese', async () => {
        await app.initBot('vi');
        expect(app.bot).not.toBeNull();
        expect(app.bot).toBeInstanceOf(RiveScript);
    });

    it('should create a RiveScript instance for English', async () => {
        await app.initBot('en');
        expect(app.bot).not.toBeNull();
    });

    it('should create a RiveScript instance for Japanese', async () => {
        await app.initBot('ja');
        expect(app.bot).not.toBeNull();
    });

    it('should allow bot.reply after initBot', async () => {
        await app.initBot('vi');
        const reply = await app.bot.reply(app.USERNAME, 'xin chao');
        expect(typeof reply).toBe('string');
        expect(reply.length).toBeGreaterThan(0);
    });

    it('should show error when RiveScript CDN is not loaded', async () => {
        const origRS = globalThis.RiveScript;
        delete globalThis.RiveScript;

        await app.initBot('vi');

        const display = document.getElementById('message-display');
        expect(display.textContent).toContain('không khả dụng');

        globalThis.RiveScript = origRS;
    });

    it('should set bot to null on stream error', async () => {
        const origRS = globalThis.RiveScript;
        globalThis.RiveScript = class FakeRS {
            constructor() {}
            stream() { throw new Error('parse error'); }
            sortReplies() {}
        };

        await app.initBot('vi');
        expect(app.bot).toBeNull();

        const display = document.getElementById('message-display');
        expect(display.textContent).toContain('Không thể khởi tạo');

        globalThis.RiveScript = origRS;
    });
});
