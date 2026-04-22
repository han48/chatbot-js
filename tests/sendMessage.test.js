import { describe, it, expect, beforeEach } from 'vitest';
import RiveScript from 'rivescript';

// Make RiveScript available globally so initBot can find it
globalThis.RiveScript = RiveScript;

const app = require('../app.js');

describe('sendMessage', () => {
    beforeEach(async () => {
        app.bot = null;
        app.currentLang = 'vi';
        document.body.innerHTML = `
            <div id="message-display"></div>
            <input type="text" id="message-input" />
        `;
        await app.initBot('vi');
    });

    it('should not send empty messages', async () => {
        const input = document.getElementById('message-input');
        input.value = '   ';
        await app.sendMessage();

        const display = document.getElementById('message-display');
        expect(display.children.length).toBe(0);
    });

    it('should display user message and bot reply for a known trigger', async () => {
        const input = document.getElementById('message-input');
        input.value = 'xin chao';
        await app.sendMessage();

        const display = document.getElementById('message-display');
        const messages = display.querySelectorAll('.message');
        expect(messages.length).toBe(2);

        // First message is user
        expect(messages[0].classList.contains('user')).toBe(true);
        expect(messages[0].querySelector('.message-text').textContent).toBe('xin chao');

        // Second message is bot
        expect(messages[1].classList.contains('bot')).toBe(true);
        expect(messages[1].querySelector('.message-text').textContent.length).toBeGreaterThan(0);
    });

    it('should clear input after sending', async () => {
        const input = document.getElementById('message-input');
        input.value = 'xin chao';
        await app.sendMessage();

        expect(input.value).toBe('');
    });

    it('should show confidence for bot reply on known trigger (high confidence)', async () => {
        const input = document.getElementById('message-input');
        input.value = 'xin chao';
        await app.sendMessage();

        const display = document.getElementById('message-display');
        const botMsg = display.querySelectorAll('.message.bot');
        expect(botMsg.length).toBe(1);

        const confSpan = botMsg[0].querySelector('.confidence');
        expect(confSpan).not.toBeNull();
        expect(confSpan.classList.contains('confidence-high')).toBe(true);
        expect(confSpan.textContent).toContain('100%');
    });

    it('should show low confidence and fallback message for unknown input', async () => {
        const input = document.getElementById('message-input');
        input.value = 'something random unknown xyz';
        await app.sendMessage();

        const display = document.getElementById('message-display');
        const botMsg = display.querySelectorAll('.message.bot');
        expect(botMsg.length).toBe(1);

        const confSpan = botMsg[0].querySelector('.confidence');
        expect(confSpan).not.toBeNull();
        expect(confSpan.classList.contains('confidence-low')).toBe(true);
        // Since callFallbackAPI stub returns null, should show RiveScript reply + error message
        expect(botMsg[0].querySelector('.message-text').textContent).toContain('Dịch vụ bổ sung không khả dụng');
    });

    it('should show error when bot is not initialized', async () => {
        app.bot = null;
        const input = document.getElementById('message-input');
        input.value = 'xin chao';
        await app.sendMessage();

        const display = document.getElementById('message-display');
        // Should have user message + error message
        const messages = display.querySelectorAll('.message');
        expect(messages.length).toBe(2);
        expect(messages[1].querySelector('.message-text').textContent).toContain('chưa sẵn sàng');
    });

    it('should do nothing when input element is missing', async () => {
        document.body.innerHTML = '<div id="message-display"></div>';
        // Should not throw
        await app.sendMessage();
        const display = document.getElementById('message-display');
        expect(display.children.length).toBe(0);
    });
});

describe('showLoadingIndicator / hideLoadingIndicator', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="message-display"></div>';
    });

    it('should add a loading indicator to message display', () => {
        const el = app.showLoadingIndicator();
        expect(el).not.toBeNull();
        expect(el.classList.contains('loading-indicator')).toBe(true);

        const display = document.getElementById('message-display');
        expect(display.contains(el)).toBe(true);
    });

    it('should remove loading indicator from DOM', () => {
        const el = app.showLoadingIndicator();
        app.hideLoadingIndicator(el);

        const display = document.getElementById('message-display');
        expect(display.querySelector('.loading-indicator')).toBeNull();
    });

    it('should handle null element gracefully', () => {
        // Should not throw
        app.hideLoadingIndicator(null);
    });
});

describe('callFallbackAPI', () => {
    it('should return answer string on successful API response', async () => {
        const mockResponse = { answer: 'API response here' };
        globalThis.fetch = async () => ({
            json: async () => mockResponse
        });

        const result = await app.callFallbackAPI('test message');
        expect(result).toBe('API response here');

        delete globalThis.fetch;
    });

    it('should return null when fetch throws (network error)', async () => {
        globalThis.fetch = async () => { throw new Error('Network error'); };

        const result = await app.callFallbackAPI('test message');
        expect(result).toBeNull();

        delete globalThis.fetch;
    });

    it('should return null when API returns no answer field', async () => {
        globalThis.fetch = async () => ({
            json: async () => ({ unrelated: 'data' })
        });

        const result = await app.callFallbackAPI('test message');
        expect(result).toBeNull();

        delete globalThis.fetch;
    });

    it('should support reply and response fields as fallback', async () => {
        globalThis.fetch = async () => ({
            json: async () => ({ reply: 'reply field' })
        });
        expect(await app.callFallbackAPI('test')).toBe('reply field');

        globalThis.fetch = async () => ({
            json: async () => ({ response: 'response field' })
        });
        expect(await app.callFallbackAPI('test')).toBe('response field');

        delete globalThis.fetch;
    });

    it('should send POST with correct body and headers', async () => {
        let capturedOptions = null;
        globalThis.fetch = async (url, options) => {
            capturedOptions = options;
            return { json: async () => ({ answer: 'ok' }) };
        };

        await app.callFallbackAPI('hello world');

        expect(capturedOptions.method).toBe('POST');
        expect(capturedOptions.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(capturedOptions.body)).toEqual({ message: 'hello world' });
        expect(capturedOptions.signal).toBeInstanceOf(AbortSignal);

        delete globalThis.fetch;
    });

    it('should return null when request is aborted (timeout)', async () => {
        globalThis.fetch = async (url, options) => {
            // Simulate abort
            const error = new DOMException('The operation was aborted.', 'AbortError');
            throw error;
        };

        const result = await app.callFallbackAPI('test');
        expect(result).toBeNull();

        delete globalThis.fetch;
    });
});
