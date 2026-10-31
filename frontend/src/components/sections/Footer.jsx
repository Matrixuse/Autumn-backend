import { Link } from 'react-router-dom'

const footerGroups = [
    {
        title: 'Company',
        links: [
            ['About', '/info/about'],
            ['Jobs', '/info/jobs'],
            ['For the Record', '/info/for-the-record']
        ]
    },
    {
        title: 'Communities',
        links: [
            ['For Artists', '/info/for-artists'],
            ['Developers', '/info/developers'],
            ['Investors', '/info/investors'],
            ['Vendors', '/info/vendors']
        ]
    },
    {
        title: 'Useful links',
        links: [
            ['Support', '/info/support'],
            ['Feedback', '/feedback'],
            ['Free Mobile App', '/info/free-mobile-app']
        ]
    },
    {
        title: 'Autumn Plans',
        links: [
            ['Autumn Individual', '/info/autumn-individual'],
            ['Autumn Family', '/info/autumn-family'],
            ['Autumn Student', '/info/autumn-student'],
            ['Autumn Free', '/info/autumn-free']
        ]
    }
]

const legalLinks = [
    ['Legal', '/info/legal'],
    ['Safety & Privacy Center', '/info/safety-privacy'],
    ['Privacy Policy', '/info/privacy-policy'],
    ['Cookies', '/info/cookies'],
    ['Accessibility', '/info/accessibility']
]

export default function Footer() {
    return (
        <footer className="mt-8 w-full pb-4 pt-12 text-sm text-gray-400">
            <div className="mb-8 border-t border-gray-700" />
            <div className="mb-8 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4 md:gap-x-8">
                {footerGroups.map((group) => (
                    <div key={group.title} className="space-y-3">
                        <h3 className="mb-4 font-bold text-white">{group.title}</h3>
                        {group.links.map(([label, to]) => (
                            <Link key={to} to={to} className="block w-fit max-w-full text-left hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d29a55]">
                                {label}
                            </Link>
                        ))}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 items-start gap-y-5 border-t border-gray-700 pt-6 text-xs md:grid-cols-[1fr_auto]">
                <nav aria-label="Legal links" className="flex flex-wrap gap-x-5 gap-y-3">
                    {legalLinks.map(([label, to]) => (
                        <Link key={to} to={to} className="hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d29a55]">
                            {label}
                        </Link>
                    ))}
                </nav>
                <div className="flex flex-col md:items-end">
                    <span>© 2026 Autumn</span>
                    <span>Created by Naman</span>
                </div>
            </div>
        </footer>
    )
}