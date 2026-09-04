import projects from './projects.js'

/**
 * The TV playlist: one video per application, in the same order as the wall.
 *
 * Built from config/projects.js so the TV menu, the framed prints and the
 * panel copy can never list different things. Drop the files in
 * `static/video/` using the name below and they play; an entry whose file is
 * missing still appears, marked as pending.
 */
export default projects.map((project) => ({
    id: project.id,
    title: project.name,
    note: project.tag,
    mark: project.mark,
    color: project.color,
    file: `${project.id}.mp4`,
}))
