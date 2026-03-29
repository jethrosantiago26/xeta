function PageHeader({ eyebrow, title, description, action }) {
  return (
    <section className="content-card">
      <div className="toolbar">
        <div>
          <p className="eyebrow-inline">{eyebrow}</p>
          <h1>{title}</h1>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        {action}
      </div>
    </section>
  )
}

export default PageHeader