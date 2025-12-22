/**
 * Play a beep sound using the Web Audio API.
 * Useful for scanner feedback without external assets.
 */
export const playBeep = (frequency = 1000, duration = 100, type: OscillatorType = 'square') => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = type;
        oscillator.frequency.value = frequency; // Hz

        gainNode.gain.value = 0.1; // Volume (0.0 - 1.0)

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start();

        setTimeout(() => {
            oscillator.stop();
        }, duration);
    } catch (e) {
        console.error("Audio API not supported or error playing beep", e);
    }
};
