import { describe, it, expect, beforeEach } from 'vitest';
import RiveScript from 'rivescript';

globalThis.RiveScript = RiveScript;

const app = require('../app.js');

describe('changeLanguage', () => {
    beforeEach(() => {
        app.bot = null;
        app.currentLang = 'vi';
        document.body.innerHTML = '<div id="message-display"></div>';
    });

    it('should update currentLang to the selected language', async () => {
        await app.changeLanguage('en');
        expect(app.currentLang).toBe('en');
    });

    it('should clear message display when changing language', async () => {
        const display = document.getElementById('message-display');
        display.innerHTML = '<div class="message user">old message</div>';

        await app.changeLanguage('en');

        // Should have only the greeting, old messages cleared
        const messages = display.querySelectorAll('.message');
        expect(messages.length).toBe(1);
        expect(messages[0].classList.contains('bot')).toBe(true);
    });

    it('should display greeting in Vietnamese', async () => {
        await app.changeLanguage('vi');
        const display = document.getElementById('message-display');
        expect(display.textContent).toContain('Hikari');
    });

    it('should display greeting in English', async () => {
        await app.changeLanguage('en');
        const display = document.getElementById('message-display');
        expect(display.textContent).toContain('Hikari');
    });

    it('should display greeting in Japanese', async () => {
        await app.changeLanguage('ja');
        const display = document.getElementById('message-display');
        expect(display.textContent).toContain('ひかり');
    });

    it('should initialize bot for the new language', async () => {
        await app.changeLanguage('en');
        expect(app.bot).not.toBeNull();

        const reply = await app.bot.reply(app.USERNAME, 'hello');
        expect(reply).toContain('Hikari');
    });

    it('should work when switching between all languages', async () => {
        await app.changeLanguage('vi');
        expect(app.currentLang).toBe('vi');
        expect(app.bot).not.toBeNull();

        await app.changeLanguage('en');
        expect(app.currentLang).toBe('en');
        expect(app.bot).not.toBeNull();

        await app.changeLanguage('ja');
        expect(app.currentLang).toBe('ja');
        expect(app.bot).not.toBeNull();
    });
});
