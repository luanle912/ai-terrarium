// Entry of the /assets page. A placeholder for now: the title and a link back to the office.
import { tr } from './i18n.js';

const h = React.createElement;

function AssetsApp() {
  return h(
    'main',
    { style: { padding: 16, color: '#fff', fontFamily: "'Pixelify Sans',monospace" } },
    h('h1', null, tr('assets.title')),
    h('a', { href: '/', style: { color: '#9cf' } }, tr('assets.back')),
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(h(AssetsApp));
