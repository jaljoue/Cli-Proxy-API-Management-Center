import { create } from 'zustand';

export type LoginTransitionPhase = 'idle' | 'revealing';

export interface LoginTransitionTimings {
  successHold: number;
  /** Minimum auto-login splash duration from page open, avoiding a flash on fast networks. */
  splashMin: number;
  exit: number;
  reveal: number;
}

export const LOGIN_TRANSITION_TIMINGS: LoginTransitionTimings = {
  successHold: 260,
  splashMin: 700,
  exit: 320,
  reveal: 640,
};

export const LOGIN_TRANSITION_TIMINGS_REDUCED: LoginTransitionTimings = {
  successHold: 260,
  splashMin: 700,
  exit: 150,
  reveal: 200,
};

export const getLoginTransitionTimings = (reducedMotion: boolean): LoginTransitionTimings =>
  reducedMotion ? LOGIN_TRANSITION_TIMINGS_REDUCED : LOGIN_TRANSITION_TIMINGS;

interface LoginTransitionState {
  phase: LoginTransitionPhase;
  /** Increment for each reveal so the veil can distinguish successive transitions. */
  revealId: number;
  startReveal: () => void;
  finishReveal: () => void;
}

export const useLoginTransitionStore = create<LoginTransitionState>((set) => ({
  phase: 'idle',
  revealId: 0,
  startReveal: () => set((state) => ({ phase: 'revealing', revealId: state.revealId + 1 })),
  finishReveal: () => set({ phase: 'idle' }),
}));

export const isArrivingFromLogin = () => useLoginTransitionStore.getState().phase === 'revealing';
