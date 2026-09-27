import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Settings2 } from 'lucide-react'

function SortableQueueItem({ track, index, renderItem }) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: String(track.id) })

  const dragHandle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      aria-label={`Reorder ${track.title || track.name || 'track'}`}
      title="Drag to reorder"
      className="grid h-8 w-8 shrink-0 touch-none cursor-grab place-items-center rounded text-white/45 transition hover:bg-white/8 hover:text-white active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <Settings2 size={20} aria-hidden="true" />
    </button>
  )

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative rounded transition-shadow ${isDragging ? 'z-20 scale-[1.02] opacity-90 shadow-xl ring-1 ring-white/20' : ''}`}
    >
      {renderItem(track, index, dragHandle)}
    </div>
  )
}

export default function SortableQueueList({ tracks, reorderQueue, renderItem, className = '' }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return

    const fromIndex = tracks.findIndex((track) => String(track.id) === String(active.id))
    const toIndex = tracks.findIndex((track) => String(track.id) === String(over.id))
    if (fromIndex >= 0 && toIndex >= 0) reorderQueue(fromIndex, toIndex)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tracks.map((track) => String(track.id))} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {tracks.map((track, index) => (
            <SortableQueueItem key={track.id} track={track} index={index} renderItem={renderItem} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}