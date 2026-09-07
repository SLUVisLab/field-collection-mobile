import { useEffect, useState } from 'react';

/**
 * Scales the device frame to whatever space the host actually gave us.
 *
 * The Composer hosts this renderer in a fixed-size pane — measured at 512×433
 * in a 1600×1000 window — whose container is `overflow: hidden`. A frame drawn
 * at a fixed zoom is simply clipped there, so the bottom of the phone (which is
 * where a Tool's Accept button lives) was invisible until the author resized a
 * pane they had no reason to know about.
 *
 * Fitting is the renderer's own job: it is the only party that knows both the
 * frame it wants to draw and the room it was given. Doing it here means no
 * Composer patch, and it works the same in any host — a wrapper panel, a
 * VS Code webview, a phone-sized window.
 */
export const useDeviceFrameZoom = ({ stageRef, width, height, maxZoom = 1, margin = 16 }) => {
  const [zoom, setZoom] = useState(0.72);

  function fit(availableWidth, availableHeight) {
    const byHeight = (availableHeight - margin * 2) / height;
    const byWidth = (availableWidth - margin * 2) / width;
    // Never enlarge past maxZoom: a huge pane should not produce a comic phone.
    return Math.max(0.2, Math.min(maxZoom, byHeight, byWidth));
  }

  useEffect(() => {
    // The **stage** is what to fit into, not the window: the fidelity strip and
    // anything else the shell adds take their own room, and measuring the
    // window would hand the frame space that is already spoken for.
    const stage = stageRef?.current;
    if (!stage) return undefined;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setZoom(fit(rect.width, rect.height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stageRef, width, height, maxZoom, margin]);

  return zoom;
};
