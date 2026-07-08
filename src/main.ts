import './style.css';
import { createStore, initialState } from './state';
import { initSourcePanel } from './ui/sourcePanel';
import { initCanvasView } from './ui/canvasView';
import { initAnimPanel } from './ui/animPanel';

const store = createStore(initialState());
initSourcePanel(store);
initAnimPanel(store);
export const canvasView = initCanvasView(store);
export { store };
