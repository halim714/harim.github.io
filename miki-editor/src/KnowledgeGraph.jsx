import { useState, useEffect, useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

import { createLogger } from './utils/logger';

const logger = createLogger('KnowledgeGraph');

// Function to process notes index into graph data
const processNotesForGraph = (notes) => {
  if (!Array.isArray(notes) || notes.length === 0) {
    return { nodes: [], links: [] };
  }

  const nodes = notes.map(note => ({
    id: note.slug, // Use slug as unique ID
    name: note.title,
    val: 1, // Basic size, could be based on connections or content length
    // Add other properties if needed, e.g., group based on tags
  }));

  const links = [];
  const nodeIds = new Set(nodes.map(n => n.id));

  notes.forEach(note => {
    // Links based on explicit parent/child (if available)
    if (note.parent && nodeIds.has(note.parent)) {
      links.push({ source: note.slug, target: note.parent, type: 'parent' });
    }

    // Links based on tags (connect notes with shared tags)
    if (note.tags && Array.isArray(note.tags)) {
      note.tags.forEach(tag => {
        notes.forEach(otherNote => {
          if (note.slug !== otherNote.slug && otherNote.tags && otherNote.tags.includes(tag)) {
            // Avoid duplicate links
            const exists = links.some(
              link => (link.source === note.slug && link.target === otherNote.slug) || (link.source === otherNote.slug && link.target === note.slug)
            );
            if (!exists) {
              links.push({ source: note.slug, target: otherNote.slug, type: 'tag', tag: tag });
            }
          }
        });
      });
    }
    
    // TODO: Add links based on [[wiki-links]] if parsed and available in index
  });

  return { nodes, links };
};

function KnowledgeGraph({ notesIndex }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const graphRef = useRef();

  useEffect(() => {
    const data = processNotesForGraph(notesIndex);
    setGraphData(data);
    logger.debug("Processed graph data:", data);
  }, [notesIndex]);

  // Handle node click - navigate to the note page
  const handleNodeClick = useCallback(node => {
    // Assuming notes are accessible via /slug or /_notes/slug.md
    // Adjust the URL structure based on your Jekyll setup
    window.open(`/${node.id}`, '_blank'); // Open in new tab
    // Optional: Center graph on clicked node
    // graphRef.current.centerAt(node.x, node.y, 1000);
    // graphRef.current.zoom(2, 1000);
  }, []);

  // Optional: Customize node appearance
  const nodeCanvasObject = (node, ctx, globalScale) => {
    const label = node.name || node.id;
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    const textWidth = ctx.measureText(label).width;
    const bgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4); // Box padding

    // Background rectangle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(node.x - bgDimensions[0] / 2, node.y - bgDimensions[1] / 2, ...bgDimensions);

    // Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgb(50, 50, 50)';
    ctx.fillText(label, node.x, node.y);

    node.__bckgDimensions = bgDimensions; // Store for interaction
  };

  // Optional: Customize link appearance
  const linkCanvasObject = (link, ctx, globalScale) => {
    const start = link.source;
    const end = link.target;

    // Ignore unbound links
    if (typeof start !== 'object' || typeof end !== 'object') return;

    // Line style
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.lineWidth = 0.5 / globalScale;
    ctx.strokeStyle = link.type === 'parent' ? 'rgba(0, 255, 0, 0.5)' : 'rgba(0, 0, 255, 0.2)'; // Green for parent, blue for tag
    ctx.stroke();

    // Optional: Add arrow for parent links
    if (link.type === 'parent') {
        const arrowLength = 5 / globalScale;
        const arrowAngle = Math.PI / 6;
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - arrowLength * Math.cos(angle - arrowAngle), end.y - arrowLength * Math.sin(angle - arrowAngle));
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(end.x - arrowLength * Math.cos(angle + arrowAngle), end.y - arrowLength * Math.sin(angle + arrowAngle));
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.lineWidth = 0.5 / globalScale;
        ctx.stroke();
    }
  };

  return (
    <div className="w-full h-full bg-gray-100 rounded-lg overflow-hidden shadow-inner">
      {graphData.nodes.length > 0 ? (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          nodeLabel="name" // Show title on hover
          // Node appearance
          nodeVal="val"
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={(node, color, ctx) => {
            ctx.fillStyle = color;
            const bckgDimensions = node.__bckgDimensions;
            bckgDimensions && ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y - bckgDimensions[1] / 2, ...bckgDimensions);
          }}
          // Link appearance
          // linkDirectionalParticles={1}
          // linkDirectionalParticleWidth={1}
          linkCanvasObjectMode={() => 'after'}
          linkCanvasObject={linkCanvasObject}
          // Interaction
          onNodeClick={handleNodeClick}
          // Performance
          cooldownTicks={100}
          onEngineStop={() => graphRef.current.zoomToFit(400, 100)} // Zoom to fit after stabilization
          // Styling
          backgroundColor="#f7fafc" // Tailwind gray-100
          width={undefined} // Use container width
          height={undefined} // Use container height
        />
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">
          {notesIndex === null ? 'Loading graph data...' : 'No notes found to display graph.'}
        </div>
      )}
    </div>
  );
}

export default KnowledgeGraph;

