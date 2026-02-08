-- =============================================
-- ADD SCENES COLUMN TO COMPOSITIONS
-- =============================================
-- Scenes provide slide-based editing workflow.
-- Each scene can have its own background color and transition.
-- =============================================

alter table public.compositions
add column scenes jsonb not null default '[]';

comment on column public.compositions.scenes is 'Scenes for slide-based editing workflow. Each scene has startFrame, durationInFrames, name, optional transition.';
