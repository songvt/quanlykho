let audioCtx: AudioContext | null = null;

/**
 * Play a beep sound using the Web Audio API.
 * Uses a singleton AudioContext to adhere to browser autoplay policies.
 */
export const playBeep = async (frequency = 1200, duration = 150, type: OscillatorType = 'square') => {
    try {
        if (!audioCtx) {
            const CtxClass = window.AudioContext || (window as any).webkitAudioContext;
            if (CtxClass) {
                audioCtx = new CtxClass();
            } else {
                return;
            }
        }

        // Resume context if suspended (common in browsers preventing autoplay)
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);

        // Increase volume (was 0.1, now 0.5)
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        // Fade out to avoid clicking sound at end
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + (duration / 1000));

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + (duration / 1000));

    } catch (e) {
        console.error("Error playing beep", e);
    }
};
