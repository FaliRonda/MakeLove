import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  useStoriesList,
  useChaptersByStory,
  useMissionsByChapter,
  useCreateStory,
  useUpdateStory,
  useDeleteStory,
  useCreateChapter,
  useUpdateChapter,
  useDeleteChapter,
  useCreateMission,
  useUpdateMission,
  useDeleteMission,
  type Story,
  type Chapter,
  type Mission,
  type StoryStatus,
  type MissionTargetType,
  type MissionMetricType,
} from '@/hooks/useAdminHistoria'
import { formatDate } from '@/lib/utils'

// ---- Labels ----

const STATUS_LABELS: Record<StoryStatus, string> = {
  planned: 'Planificada',
  active: 'Activa',
  closed: 'Cerrada',
}

const METRIC_LABELS: Record<MissionMetricType, string> = {
  actions_done: 'Acciones realizadas',
  requests_sent_confirmed: 'Solicitudes enviadas y confirmadas',
  requests_received_confirmed: 'Solicitudes recibidas y confirmadas',
  points_gained: 'Puntos ganados',
  levels_gained: 'Niveles subidos',
  prior_missions_complete: 'Misiones previas completadas (pool + cantidad)',
}

// ---- Forms ----

function StoryForm({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial?: Partial<Story>
  onSave: (data: Omit<Story, 'id' | 'created_at'>) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [startDate, setStartDate] = useState(initial?.start_date ?? '')
  const [endDate, setEndDate] = useState(initial?.end_date ?? '')
  const [status, setStatus] = useState<StoryStatus>(initial?.status ?? 'planned')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ name, description, start_date: startDate, end_date: endDate, status })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-app-bg rounded-xl p-4 border border-app-border">
      <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
      <div>
        <label className="block text-sm font-medium text-app-foreground mb-1">Descripción</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 rounded-lg border border-app-border-hover bg-app-surface text-app-foreground placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        <Input label="Fin" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-app-foreground mb-1">Estado</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StoryStatus)}
          className="w-full px-4 py-2 rounded-lg border border-app-border-hover bg-app-surface text-app-foreground focus:outline-none focus:ring-2 focus:ring-app-accent"
        >
          {(['planned', 'active', 'closed'] as StoryStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" loading={isPending} disabled={isPending}>Guardar</Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>Cancelar</Button>
      </div>
    </form>
  )
}

function ChapterForm({
  storyId,
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  storyId: string
  initial?: Partial<Chapter>
  onSave: (data: Omit<Chapter, 'id' | 'created_at'>) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [orderNumber, setOrderNumber] = useState(String(initial?.order_number ?? ''))
  const [startDate, setStartDate] = useState(initial?.start_date ?? '')
  const [endDate, setEndDate] = useState(initial?.end_date ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ story_id: storyId, name, order_number: Number(orderNumber), start_date: startDate, end_date: endDate })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-app-bg rounded-xl p-4 border border-app-border">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <Input label="Orden" type="number" min={1} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        <Input label="Fin" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="submit" loading={isPending} disabled={isPending}>Guardar</Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>Cancelar</Button>
      </div>
    </form>
  )
}

function MissionForm({
  chapterId,
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  chapterId: string
  initial?: Partial<Mission>
  onSave: (data: {
    chapter_id: string
    order_number: number
    title: string
    description: string
    target_type: MissionTargetType
    reward_piedritas: number
    requirement?: { metric_type: MissionMetricType; required_amount: number }
  }) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [orderNumber, setOrderNumber] = useState(String(initial?.order_number ?? ''))
  const [targetType, setTargetType] = useState<MissionTargetType>(initial?.target_type ?? 'individual')
  const [rewardPiedritas, setRewardPiedritas] = useState(String(initial?.reward_piedritas ?? '0'))
  const [metricType, setMetricType] = useState<MissionMetricType>(
    initial?.requirement?.metric_type ?? 'actions_done'
  )
  const [requiredAmount, setRequiredAmount] = useState(String(initial?.requirement?.required_amount ?? '1'))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      chapter_id: chapterId,
      order_number: Number(orderNumber),
      title,
      description,
      target_type: targetType,
      reward_piedritas: Number(rewardPiedritas),
      requirement: { metric_type: metricType, required_amount: Number(requiredAmount) },
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-app-bg rounded-xl p-4 border border-app-border">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <Input label="Orden" type="number" min={1} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-app-foreground mb-1">Descripción</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-4 py-2 rounded-lg border border-app-border-hover bg-app-surface text-app-foreground placeholder-app-muted focus:outline-none focus:ring-2 focus:ring-app-accent resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-app-foreground mb-1">Tipo</label>
          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as MissionTargetType)}
            className="w-full px-4 py-2 rounded-lg border border-app-border-hover bg-app-surface text-app-foreground focus:outline-none focus:ring-2 focus:ring-app-accent"
          >
            <option value="individual">Individual</option>
            <option value="couple">Pareja</option>
          </select>
        </div>
        <Input
          label="Piedritas de recompensa"
          type="number"
          min={0}
          value={rewardPiedritas}
          onChange={(e) => setRewardPiedritas(e.target.value)}
          required
        />
      </div>

      {/* Requisito único */}
      <div className="border-t border-app-border pt-3">
        <p className="text-xs font-semibold text-app-muted uppercase tracking-wide mb-2">Requisito</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-app-foreground mb-1">Métrica</label>
            <select
              value={metricType}
              onChange={(e) => setMetricType(e.target.value as MissionMetricType)}
              className="w-full px-4 py-2 rounded-lg border border-app-border-hover bg-app-surface text-app-foreground focus:outline-none focus:ring-2 focus:ring-app-accent"
            >
              {(Object.keys(METRIC_LABELS) as MissionMetricType[]).map((k) => (
                <option key={k} value={k}>{METRIC_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <Input
            label="Cantidad requerida"
            type="number"
            min={1}
            value={requiredAmount}
            onChange={(e) => setRequiredAmount(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" loading={isPending} disabled={isPending}>Guardar</Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>Cancelar</Button>
      </div>
    </form>
  )
}

// ---- Página principal ----

export function HistoriaManage() {
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null)
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)

  const [editingStory, setEditingStory] = useState<Story | null>(null)
  const [creatingStory, setCreatingStory] = useState(false)
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null)
  const [creatingChapter, setCreatingChapter] = useState(false)
  const [editingMission, setEditingMission] = useState<Mission | null>(null)
  const [creatingMission, setCreatingMission] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const { data: stories = [], isLoading: loadingStories } = useStoriesList()
  const { data: chapters = [], isLoading: loadingChapters } = useChaptersByStory(selectedStoryId)
  const { data: missions = [], isLoading: loadingMissions } = useMissionsByChapter(selectedChapterId)

  const createStory = useCreateStory()
  const updateStory = useUpdateStory()
  const deleteStory = useDeleteStory()
  const createChapter = useCreateChapter()
  const updateChapter = useUpdateChapter()
  const deleteChapter = useDeleteChapter()
  const createMission = useCreateMission()
  const updateMission = useUpdateMission()
  const deleteMission = useDeleteMission()

  const selectedStory = stories.find((s) => s.id === selectedStoryId) ?? null
  const selectedChapter = chapters.find((c) => c.id === selectedChapterId) ?? null

  const wrap = async (fn: () => Promise<unknown>) => {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    }
  }

  // ---- Level: Story list ----

  if (!selectedStoryId) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-app-foreground">Gestionar Historias</h1>
            <p className="text-sm text-app-muted mt-0.5">Crea y edita Historias, Capítulos y Misiones</p>
          </div>
          <Button size="sm" onClick={() => { setCreatingStory(true); setEditingStory(null) }} disabled={creatingStory}>
            + Historia
          </Button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {creatingStory && (
          <StoryForm
            onSave={(data) =>
              wrap(async () => {
                await createStory.mutateAsync(data)
                setCreatingStory(false)
              })
            }
            onCancel={() => setCreatingStory(false)}
            isPending={createStory.isPending}
          />
        )}

        {loadingStories ? (
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-app-surface rounded-xl" />)}
          </div>
        ) : stories.length === 0 ? (
          <p className="text-sm text-app-muted text-center py-8">No hay historias todavía.</p>
        ) : (
          <div className="space-y-3">
            {stories.map((story) =>
              editingStory?.id === story.id ? (
                <StoryForm
                  key={story.id}
                  initial={story}
                  onSave={(data) =>
                    wrap(async () => {
                      await updateStory.mutateAsync({ id: story.id, ...data })
                      setEditingStory(null)
                    })
                  }
                  onCancel={() => setEditingStory(null)}
                  isPending={updateStory.isPending}
                />
              ) : (
                <div
                  key={story.id}
                  className="bg-app-surface rounded-xl border border-app-border p-4 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-app-foreground">{story.name}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                          story.status === 'active'
                            ? 'bg-green-500/15 text-green-400 border-green-500/30'
                            : story.status === 'closed'
                            ? 'bg-app-muted/10 text-app-muted border-app-border'
                            : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                        }`}
                      >
                        {STATUS_LABELS[story.status]}
                      </span>
                    </div>
                    <p className="text-xs text-app-muted mt-0.5">
                      {formatDate(story.start_date)} – {formatDate(story.end_date)}
                    </p>
                    {story.description && (
                      <p className="text-xs text-app-muted mt-1 line-clamp-2">{story.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSelectedStoryId(story.id)
                        setSelectedChapterId(null)
                      }}
                    >
                      Capítulos
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingStory(story)}>✏️</Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (confirm(`¿Eliminar "${story.name}" y todos sus capítulos/misiones?`)) {
                          void wrap(() => deleteStory.mutateAsync(story.id))
                        }
                      }}
                    >
                      🗑
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        )}

        <Link to="/admin" className="block text-app-muted hover:underline text-sm">
          ← Volver al admin
        </Link>
      </div>
    )
  }

  // ---- Level: Chapter list ----

  if (!selectedChapterId) {
    return (
      <div className="space-y-5">
        {/* Breadcrumb */}
        <div>
          <button
            onClick={() => { setSelectedStoryId(null); setEditingChapter(null); setCreatingChapter(false) }}
            className="text-sm text-app-muted hover:text-app-foreground transition-colors"
          >
            ← Historias
          </button>
          <div className="flex items-center justify-between gap-3 mt-2">
            <div>
              <h1 className="text-xl font-bold text-app-foreground">{selectedStory?.name}</h1>
              <p className="text-xs text-app-muted mt-0.5">
                {selectedStory && `${formatDate(selectedStory.start_date)} – ${formatDate(selectedStory.end_date)}`}
              </p>
            </div>
            <Button size="sm" onClick={() => { setCreatingChapter(true); setEditingChapter(null) }} disabled={creatingChapter}>
              + Capítulo
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {creatingChapter && selectedStoryId && (
          <ChapterForm
            storyId={selectedStoryId}
            onSave={(data) =>
              wrap(async () => {
                await createChapter.mutateAsync(data)
                setCreatingChapter(false)
              })
            }
            onCancel={() => setCreatingChapter(false)}
            isPending={createChapter.isPending}
          />
        )}

        {loadingChapters ? (
          <div className="animate-pulse space-y-3">
            {[...Array(2)].map((_, i) => <div key={i} className="h-16 bg-app-surface rounded-xl" />)}
          </div>
        ) : chapters.length === 0 ? (
          <p className="text-sm text-app-muted text-center py-8">No hay capítulos. Crea el primero.</p>
        ) : (
          <div className="space-y-3">
            {chapters.map((chapter) =>
              editingChapter?.id === chapter.id ? (
                <ChapterForm
                  key={chapter.id}
                  storyId={selectedStoryId!}
                  initial={chapter}
                  onSave={(data) =>
                    wrap(async () => {
                      await updateChapter.mutateAsync({ id: chapter.id, ...data })
                      setEditingChapter(null)
                    })
                  }
                  onCancel={() => setEditingChapter(null)}
                  isPending={updateChapter.isPending}
                />
              ) : (
                <div
                  key={chapter.id}
                  className="bg-app-surface rounded-xl border border-app-border p-4 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-app-foreground">
                      Cap. {chapter.order_number} · {chapter.name}
                    </h3>
                    <p className="text-xs text-app-muted mt-0.5">
                      {formatDate(chapter.start_date)} – {formatDate(chapter.end_date)}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedChapterId(chapter.id)}
                    >
                      Misiones
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingChapter(chapter)}>✏️</Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (confirm(`¿Eliminar "Cap. ${chapter.order_number} – ${chapter.name}"?`)) {
                          void wrap(() => deleteChapter.mutateAsync({ id: chapter.id, story_id: selectedStoryId! }))
                        }
                      }}
                    >
                      🗑
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    )
  }

  // ---- Level: Mission list ----

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div>
        <div className="flex gap-2 text-sm text-app-muted">
          <button
            onClick={() => { setSelectedStoryId(null); setSelectedChapterId(null) }}
            className="hover:text-app-foreground"
          >
            Historias
          </button>
          <span>/</span>
          <button
            onClick={() => { setSelectedChapterId(null); setEditingMission(null); setCreatingMission(false) }}
            className="hover:text-app-foreground"
          >
            {selectedStory?.name}
          </button>
        </div>
        <div className="flex items-center justify-between gap-3 mt-2">
          <div>
            <h1 className="text-xl font-bold text-app-foreground">
              Cap. {selectedChapter?.order_number} · {selectedChapter?.name}
            </h1>
            <p className="text-xs text-app-muted mt-0.5">
              {selectedChapter && `${formatDate(selectedChapter.start_date)} – ${formatDate(selectedChapter.end_date)}`}
            </p>
          </div>
          <Button size="sm" onClick={() => { setCreatingMission(true); setEditingMission(null) }} disabled={creatingMission}>
            + Misión
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {creatingMission && selectedChapterId && (
        <MissionForm
          chapterId={selectedChapterId}
          onSave={(data) =>
            wrap(async () => {
              await createMission.mutateAsync(data)
              setCreatingMission(false)
            })
          }
          onCancel={() => setCreatingMission(false)}
          isPending={createMission.isPending}
        />
      )}

      {loadingMissions ? (
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-app-surface rounded-xl" />)}
        </div>
      ) : missions.length === 0 ? (
        <p className="text-sm text-app-muted text-center py-8">No hay misiones. Crea la primera.</p>
      ) : (
        <div className="space-y-3">
          {missions.map((mission) =>
            editingMission?.id === mission.id ? (
              <MissionForm
                key={mission.id}
                chapterId={selectedChapterId!}
                initial={mission}
                onSave={(data) =>
                  wrap(async () => {
                    await updateMission.mutateAsync({ id: mission.id, ...data })
                    setEditingMission(null)
                  })
                }
                onCancel={() => setEditingMission(null)}
                isPending={updateMission.isPending}
              />
            ) : (
              <div
                key={mission.id}
                className="bg-app-surface rounded-xl border border-app-border p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-app-foreground">
                        {mission.order_number}. {mission.title}
                      </h3>
                      <span className="text-xs text-app-muted border border-app-border px-2 py-0.5 rounded-full">
                        {mission.target_type === 'couple' ? '💑 Pareja' : '👤 Individual'}
                      </span>
                      <span className="text-xs font-bold text-app-accent">
                        {mission.reward_piedritas} 💎
                      </span>
                    </div>
                    {mission.description && (
                      <p className="text-xs text-app-muted mt-1">{mission.description}</p>
                    )}
                    {mission.requirement && (
                      <p className="text-xs text-app-muted mt-1">
                        Req:{' '}
                        <span className="text-app-foreground">
                          {METRIC_LABELS[mission.requirement.metric_type]} × {mission.requirement.required_amount}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setEditingMission(mission)}>✏️</Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (confirm(`¿Eliminar "${mission.title}"?`)) {
                          void wrap(() => deleteMission.mutateAsync({ id: mission.id, chapter_id: selectedChapterId! }))
                        }
                      }}
                    >
                      🗑
                    </Button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
