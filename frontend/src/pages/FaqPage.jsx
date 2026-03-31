import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import { faqItems } from '../lib/faqItems.js'

function FaqPage() {
  return (
    <div className="page-grid faq-shell">
      <PageHeader
        eyebrow="Help center"
        title="FAQ"
        description="Quick, practical answers to common questions before you open a ticket."
        action={
          <Link className="button button-primary" to="/support">
            Contact Support
          </Link>
        }
      />

      <section className="faq-spotlight content-card">
        <p className="eyebrow-inline">Fast lane</p>
        <h2>Most issues are solved in under a minute.</h2>
        <p className="muted">
          Use this page for instant answers, then continue to Support if you need account-specific help.
        </p>
      </section>

      <section className="faq-grid">
        {faqItems.map((item) => (
          <details key={item.question} className="faq-item content-card" open={item.question === faqItems[0].question}>
            <summary>
              <span className="faq-chip">{item.category}</span>
              <span className="faq-question">{item.question}</span>
            </summary>
            <p className="faq-answer">{item.answer}</p>
          </details>
        ))}
      </section>
    </div>
  )
}

export default FaqPage
