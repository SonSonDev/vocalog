import { render } from 'preact';
import { App } from './App.tsx';
import './styles.css';
import './timeline.css';
import './periods.css';
import './motion.css';

const root = document.getElementById('app')!;
// The page ships with a static placeholder (web/index.html) for the moments before this script runs: clear it first.
root.textContent = '';
render(<App />, root);
