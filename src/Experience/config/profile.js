/**
 * The professional record: one source for the machine view.
 *
 * Deliberately separate from config/content.js. The room is the personal half
 * of this portfolio — who the person is, what they like, what they built for
 * themselves — and its About panel says so in three lines. The CV lives here,
 * and the machine view is where it is published, because that is the page a
 * recruiter, a crawler or an agent actually reads.
 *
 * Not translated: a machine-readable mirror has one canonical form, and it is
 * the one the rest of the industry reads.
 */
export default {
    name: 'Leonardo Santos Abreu',
    handle: 'abreusleo',
    role: 'Software Engineer Backend',
    company: 'Pismo, a Visa company',
    location: 'Rio de Janeiro, Brazil',

    summary: [
        'Backend software engineer working on core banking and card processing at Pismo.',
        'Day to day: services in Go, C# (.NET) and Python, with gRPC, Kubernetes, Amazon EKS and Istio.',
        'Outside work: this portfolio, a survival game, and six applications running on one VPS.',
    ],

    experience: [
        {
            company: 'Pismo',
            title: 'Software Engineer Backend',
            employment: 'Full-time · Remote',
            from: 'Sep 2024',
            to: 'Present',
            notes: [
                'Core banking and card processing platform, part of Visa.',
            ],
        },
        {
            company: 'Stone Age',
            title: 'Software Engineer',
            employment: 'Full-time · Remote',
            from: 'Jan 2023',
            to: 'Aug 2024',
            notes: [
                'Scalable SaaS product: new features, shared libraries, stability against client SLAs.',
                'Led the migration of a refactored service with zero downtime.',
                'Fixed a memory leak triggered by dynamic tenant configuration updates.',
                'Cut latency on a critical flow by 20% by removing redundant database calls and cold starts.',
            ],
        },
        {
            company: 'Stone Age',
            title: 'Software Developer Intern',
            employment: 'Internship',
            from: 'Jan 2021',
            to: 'Dec 2022',
            notes: [],
        },
    ],

    education: [
        {
            school: 'Pontifícia Universidade Católica do Rio de Janeiro (PUC-Rio)',
            title: 'BEng, Computer Engineering',
            from: 'Jun 2017',
            to: 'Jul 2023',
            notes: [
                'Final thesis: basketball shot-map visualisation, in partnership with Flamengo (NBB).',
                'Delivered a website and two new visualisations, replacing existing MATLAB ones.',
            ],
        },
        {
            school: 'Step Computer Academy Brasil',
            title: 'Vocational course, Software Development',
            from: 'Jan 2017',
            to: 'Jun 2020',
            notes: [],
        },
    ],

    awards: [
        '1st place — Startup Weekend, Três Rios (car wash delivery app)',
    ],

    stack: {
        languages: ['Go', 'C# / .NET', 'Python', 'TypeScript', 'Lua'],
        infrastructure: ['Kubernetes', 'Amazon EKS', 'Istio', 'Docker', 'Terraform'],
        practice: ['gRPC', 'Locust', 'unit testing', 'load testing'],
        graphics: ['three.js', 'WebGL', 'GLSL', 'Vite'],
    },

    links: [
        ['github', 'https://github.com/abreusleo'],
        ['linkedin', 'https://www.linkedin.com/in/abreusleo/'],
        ['human view', '/'],
    ],
}
