const products = ['Arc lamp', 'Linen chair', 'Oak shelf', 'Wool throw'];
const specs = ['Solid ash frame', 'Muted fabric', 'Flat packed', 'Ships in 3 days'];

export function App() {
  return (
    <main className="shop">
      <nav className="nav">
        <strong>Everyday Goods</strong>
        <a href="#details">Details</a>
        <a href="#related">Related</a>
        <button>Cart</button>
      </nav>

      <section className="pdp">
        <div className="image" aria-label="Product image placeholder" />
        <article className="summary">
          <p className="kicker">Spring edit</p>
          <h1>Modular reading chair with storage arm</h1>
          <p className="price">$249</p>
          <p className="description">
            A stretched image, unclear hierarchy, and a broken primary action make this PDP measurable for VKEN.
          </p>
          <div className="actions">
            <button className="cta" data-cta>
              Add to cart
            </button>
            <button className="secondary">Save</button>
          </div>
          <ul className="specs">
            {specs.map((spec) => (
              <li key={spec}>{spec}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="products" id="related">
        {products.map((name, index) => (
          <article key={name} className={`product product-${index + 1}`}>
            <div className="thumb" />
            <h2>{name}</h2>
            <p>${49 + index * 24}</p>
            <button>Quick add</button>
          </article>
        ))}
      </section>
    </main>
  );
}
