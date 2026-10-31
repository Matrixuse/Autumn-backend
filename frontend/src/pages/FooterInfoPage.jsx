import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { footerPageContent } from './footerPageContent'

export default function FooterInfoPage() {
    const { pageSlug } = useParams()
    const page = footerPageContent[pageSlug]

    if (!page) return <Navigate to="/" replace />

    return (
        <article className="mx-auto w-full max-w-5xl">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white">
                <ArrowLeft size={16} aria-hidden="true" />
            </Link>

            <header className="mt-8 border-b border-white/10 pb-8 md:mt-12 md:pb-10">
                <p className="text-xs font-bold uppercase tracking-[.18em] text-[#d29a55]">{page.category}</p>
                <h1 className="mt-3 max-w-3xl break-words font-['Space_Grotesk'] text-4xl font-bold text-white">
                    {page.title}
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-7 text-white/60">{page.intro}</p>
            </header>

            <div className="grid gap-x-12 md:grid-cols-2">
                {page.sections.map((section) => (
                    <section key={section.title} className="border-b border-white/10 py-6 md:py-8">
                        <h2 className="font-['Space_Grotesk'] text-xl font-semibold text-white">{section.title}</h2>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">{section.body}</p>
                    </section>
                ))}
            </div>

            <nav aria-label="More help" className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-white/45">Need a hand with Autumn?</p>
                <div className="flex flex-wrap gap-x-6 gap-y-3">
                    <Link to="/info/support" className="inline-flex items-center gap-2 text-sm font-semibold text-[#e2a853] hover:text-white">
                        Support <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                    <Link to="/feedback" className="inline-flex items-center gap-2 text-sm font-semibold text-[#e2a853] hover:text-white">
                        Send feedback <ArrowRight size={15} aria-hidden="true" />
                    </Link>
                </div>
            </nav>
        </article>
    )
}