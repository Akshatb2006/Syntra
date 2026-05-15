// No structured data, no ContactPoint schema.
export default function ContactPage() {
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-3xl font-bold text-zinc-900">Contact us</h1>
      <p className="text-zinc-700">
        We respond within one business day. Email us or use the form below.
      </p>
      <form className="space-y-4">
        <input
          type="text"
          placeholder="Your name"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <input
          type="email"
          placeholder="Email"
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <textarea
          placeholder="What are you looking for?"
          rows={5}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Send message
        </button>
      </form>
      <div className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-700">
        <p>Email: hello@bangalorehomes.example</p>
        <p>Phone: +91 80 4123 4567</p>
        <p>Office: Indiranagar, Bangalore 560038</p>
      </div>
    </div>
  );
}
