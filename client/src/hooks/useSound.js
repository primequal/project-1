// Custom hook for sound effects using Web Audio API
// Creates synthetic sounds similar to marker/pen strokes and Facebook notification

class SoundManager {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
  }

  getContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioContext;
  }

  // Marker/pen stroke sound - simulates drawing X or O
  playMoveSound() {
    if (!this.enabled) return;
    
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      // Create noise-like sound for marker effect
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);
      
      // Filter for softer sound
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.1);
      
      // Quick fade in/out like a marker stroke
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.06);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
      
      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.log('Sound not available');
    }
  }

  // Facebook-style notification sound
  playNotificationSound() {
    if (!this.enabled) return;
    
    try {
      const ctx = this.getContext();
      
      // Two-tone notification like Facebook
      const playTone = (freq, startTime, duration) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, startTime);
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
        gainNode.gain.linearRampToValueAtTime(0.25, startTime + duration * 0.5);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      // Facebook notification: two ascending tones
      const now = ctx.currentTime;
      playTone(523.25, now, 0.12);        // C5
      playTone(659.25, now + 0.12, 0.15); // E5
    } catch (e) {
      console.log('Sound not available');
    }
  }

  // Win sound - triumphant
  playWinSound() {
    if (!this.enabled) return;
    
    try {
      const ctx = this.getContext();
      
      const playTone = (freq, startTime, duration) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, startTime);
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.03);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      const now = ctx.currentTime;
      playTone(523.25, now, 0.15);         // C5
      playTone(659.25, now + 0.15, 0.15);  // E5
      playTone(783.99, now + 0.3, 0.2);    // G5
      playTone(1046.5, now + 0.5, 0.3);    // C6
    } catch (e) {
      console.log('Sound not available');
    }
  }

  // Lose sound - descending
  playLoseSound() {
    if (!this.enabled) return;
    
    try {
      const ctx = this.getContext();
      
      const playTone = (freq, startTime, duration) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(freq, startTime);
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.2, startTime + 0.03);
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      const now = ctx.currentTime;
      playTone(392, now, 0.2);        // G4
      playTone(349.23, now + 0.2, 0.2); // F4
      playTone(293.66, now + 0.4, 0.3); // D4
    } catch (e) {
      console.log('Sound not available');
    }
  }

  // Game start sound
  playGameStartSound() {
    if (!this.enabled) return;
    
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.25);
    } catch (e) {
      console.log('Sound not available');
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  isEnabled() {
    return this.enabled;
  }
}

// Singleton instance
const soundManager = new SoundManager();

export const useSound = () => {
  return {
    playMoveSound: () => soundManager.playMoveSound(),
    playNotificationSound: () => soundManager.playNotificationSound(),
    playWinSound: () => soundManager.playWinSound(),
    playLoseSound: () => soundManager.playLoseSound(),
    playGameStartSound: () => soundManager.playGameStartSound(),
    setEnabled: (enabled) => soundManager.setEnabled(enabled),
    isEnabled: () => soundManager.isEnabled(),
  };
};

export default soundManager;
