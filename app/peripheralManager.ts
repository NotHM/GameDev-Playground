// Pillar 3: App — Bluetooth & USB Gamepad Peripheral Manager with Haptic Feedback

export interface ConnectedGamepadInfo {
  index: number;
  id: string;
  layout: 'Xbox' | 'PlayStation' | 'Switch Pro' | 'SDL Generic';
  buttonsPressed: string[];
  axes: [number, number];
  hasHaptics: boolean;
}

export function detectControllerLayout(id: string): ConnectedGamepadInfo['layout'] {
  const lower = id.toLowerCase();
  if (lower.includes('xbox') || lower.includes('xinput') || lower.includes('045e')) return 'Xbox';
  if (lower.includes('dualsense') || lower.includes('dualshock') || lower.includes('054c') || lower.includes('playstation'))
    return 'PlayStation';
  if (lower.includes('switch') || lower.includes('pro controller') || lower.includes('057e')) return 'Switch Pro';
  return 'SDL Generic';
}

export function pollConnectedGamepads(): ConnectedGamepadInfo[] {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return [];
  }
  const pads = navigator.getGamepads();
  const list: ConnectedGamepadInfo[] = [];

  for (const pad of pads) {
    if (!pad || !pad.connected) continue;
    const pressed: string[] = [];
    const buttonNames = ['A / Cross', 'B / Circle', 'X / Square', 'Y / Triangle', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'L3', 'R3', 'D-Up', 'D-Down', 'D-Left', 'D-Right'];
    pad.buttons.forEach((btn, idx) => {
      if (btn.pressed) {
        pressed.push(buttonNames[idx] || `Btn-${idx}`);
      }
    });

    const axX = Number((pad.axes[0] || 0).toFixed(2));
    const axY = Number((pad.axes[1] || 0).toFixed(2));
    const actuator = (pad as unknown as { vibrationActuator?: { playEffect?: unknown } }).vibrationActuator;

    list.push({
      index: pad.index,
      id: pad.id,
      layout: detectControllerLayout(pad.id),
      buttonsPressed: pressed,
      axes: [axX, axY],
      hasHaptics: Boolean(actuator && typeof actuator.playEffect === 'function'),
    });
  }
  return list;
}

export async function triggerGamepadHaptics(intensity = 0.65, durationMs = 90): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return false;
  const pads = navigator.getGamepads();
  for (const pad of pads) {
    if (!pad || !pad.connected) continue;
    const actuator = (pad as unknown as {
      vibrationActuator?: {
        playEffect: (type: string, params: { startDelay: number; duration: number; weakMagnitude: number; strongMagnitude: number }) => Promise<void>;
      };
    }).vibrationActuator;
    if (actuator && typeof actuator.playEffect === 'function') {
      try {
        await actuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: durationMs,
          weakMagnitude: Math.min(1, intensity * 0.8),
          strongMagnitude: Math.min(1, intensity),
        });
        return true;
      } catch {
        return false;
      }
    }
  }
  return false;
}
