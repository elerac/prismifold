import './project-page.css';

const embedViewer = document.querySelector('openexr-viewer[data-responsive-height]');
const mobileEmbedHeightQuery = window.matchMedia('(max-width: 620px)');

function syncEmbedViewerHeight(): void {
  embedViewer?.setAttribute('height', mobileEmbedHeightQuery.matches ? '320' : '420');
}

syncEmbedViewerHeight();
mobileEmbedHeightQuery.addEventListener('change', syncEmbedViewerHeight);
