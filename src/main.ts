import './style.css';
import { createStore, initialState } from './state';
import { initSourcePanel } from './ui/sourcePanel';
import { initCanvasView } from './ui/canvasView';

const store = createStore(initialState());
initSourcePanel(store);
export const canvasView = initCanvasView(store);
export { store };
