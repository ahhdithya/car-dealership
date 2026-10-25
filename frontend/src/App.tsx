import { useState, type FormEvent } from "react";

type User = {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
};

type Vehicle = {
  id: string;
  make: string;
  model: string;
  category: string;
  price: string;
  stock: number;
};

type Session = {
  accessToken: string;
  user: User;
};

async function api<T>(path: string, token = "", method = "GET", body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};

  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;

    try {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      message = payload.error?.message ?? message;
    } catch {
      // Preserve the fallback message for non-JSON responses.
    }

    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

function text(data: FormData, name: string): string {
  return String(data.get(name) ?? "");
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [registering, setRegistering] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isAdmin = session?.user.role === "ADMIN";

  async function loadInventory(token: string, search: string): Promise<void> {
    const result = await api<{ vehicles: Vehicle[] }>(
      `/vehicles${search ? `?${search}` : ""}`,
      token,
    );
    setVehicles(result.vehicles);
  }

  async function authenticate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = {
      email: text(data, "email"),
      password: text(data, "password"),
    };

    setBusy(true);
    setError("");
    setNotice("");

    try {
      if (registering) {
        await api("/auth/register", "", "POST", input);
        setRegistering(false);
        setNotice("Account created. Sign in with your email and password.");
      } else {
        const result = await api<Session>("/auth/login", "", "POST", input);
        setSession(result);
        setQuery("");
        await loadInventory(result.accessToken, "");
      }
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(false);
    }
  }

  async function search(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!session) return;

    const data = new FormData(event.currentTarget);
    const parameters = new URLSearchParams();

    for (const key of ["make", "model", "category", "minPrice", "maxPrice"]) {
      const value = text(data, key).trim();
      if (value) parameters.set(key, value);
    }

    const nextQuery = parameters.toString();

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await loadInventory(session.accessToken, nextQuery);
      setQuery(nextQuery);
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(false);
    }
  }

  async function mutate(
    path: string,
    method: string,
    body: unknown,
    successMessage: string,
  ): Promise<boolean> {
    if (!session) return false;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await api(path, session.accessToken, method, body);
      setNotice(successMessage);

      try {
        await loadInventory(session.accessToken, query);
      } catch {
        setError("The change succeeded, but inventory could not refresh. Click Search to retry.");
      }

      return true;
    } catch (failure) {
      setError(messageFor(failure));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveVehicle(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    const details = {
      make: text(data, "make"),
      model: text(data, "model"),
      category: text(data, "category"),
      price: text(data, "price"),
    };

    const saved = await mutate(
      editing ? `/vehicles/${editing.id}` : "/vehicles",
      editing ? "PUT" : "POST",
      editing ? details : { ...details, stock: Number(text(data, "stock")) },
      editing ? "Vehicle updated." : "Vehicle added.",
    );

    if (saved) {
      form.reset();
      setEditing(null);
    }
  }

  function logout(): void {
    setSession(null);
    setVehicles([]);
    setEditing(null);
    setQuery("");
    setError("");
    setNotice("");
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            CD
          </span>
          Car Dealership
        </a>

        {session && (
          <div className="account">
            <span>{session.user.email}</span>
            <span className="badge">{session.user.role}</span>
            <button className="secondary" onClick={logout} disabled={busy}>
              Sign out
            </button>
          </div>
        )}
      </header>

      <main>
        <section className="page-heading">
          <p className="eyebrow">FIND YOUR NEXT DRIVE</p>
          <h1>Vehicle inventory</h1>
          <p>Browse available vehicles, compare prices, and purchase with confidence.</p>
        </section>

        {error && (
          <div className="message error" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="message success" role="status">
            {notice}
          </div>
        )}

        {!session ? (
          <section className="panel auth-panel">
            <h2>{registering ? "Create your account" : "Welcome back"}</h2>
            <p className="muted">
              {registering
                ? "Register to browse and purchase vehicles."
                : "Sign in to view the inventory."}
            </p>

            <form onSubmit={(event) => void authenticate(event)}>
              <label>
                Email
                <input name="email" type="email" autoComplete="email" required />
              </label>

              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={registering ? "new-password" : "current-password"}
                  minLength={registering ? 12 : 1}
                  maxLength={128}
                  required
                />
              </label>

              {registering && <p className="muted">Use 12–128 characters.</p>}

              <button type="submit" disabled={busy}>
                {busy ? "Please wait…" : registering ? "Create account" : "Sign in"}
              </button>

              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setRegistering(!registering);
                  setError("");
                  setNotice("");
                }}
              >
                {registering ? "Already registered? Sign in" : "New here? Create an account"}
              </button>
            </form>
          </section>
        ) : (
          <>
            <section className="panel">
              <h2>Search inventory</h2>

              <form className="filter-grid" onSubmit={(event) => void search(event)}>
                <label>
                  Brand
                  <input name="make" placeholder="Toyota" maxLength={100} />
                </label>
                <label>
                  Model
                  <input name="model" placeholder="Corolla" maxLength={100} />
                </label>
                <label>
                  Category
                  <input name="category" placeholder="Sedan" maxLength={100} />
                </label>
                <label>
                  Minimum price
                  <input name="minPrice" type="number" min="0" max="9999999999.99" step="0.01" />
                </label>
                <label>
                  Maximum price
                  <input name="maxPrice" type="number" min="0" max="9999999999.99" step="0.01" />
                </label>
                <button type="submit" disabled={busy}>
                  {busy ? "Working…" : "Search"}
                </button>
              </form>
            </section>

            {isAdmin && (
              <section className="panel">
                <h2>{editing ? "Edit vehicle" : "Add a vehicle"}</h2>

                <form
                  key={editing?.id ?? "new"}
                  className="editor-grid"
                  onSubmit={(event) => void saveVehicle(event)}
                >
                  <label>
                    Brand
                    <input
                      name="make"
                      defaultValue={editing?.make ?? ""}
                      maxLength={100}
                      required
                    />
                  </label>
                  <label>
                    Model
                    <input
                      name="model"
                      defaultValue={editing?.model ?? ""}
                      maxLength={100}
                      required
                    />
                  </label>
                  <label>
                    Category
                    <input
                      name="category"
                      defaultValue={editing?.category ?? ""}
                      maxLength={100}
                      required
                    />
                  </label>
                  <label>
                    Price
                    <input
                      name="price"
                      type="number"
                      min="0.01"
                      max="9999999999.99"
                      step="0.01"
                      defaultValue={editing?.price ?? ""}
                      required
                    />
                  </label>

                  {!editing && (
                    <label>
                      Initial stock
                      <input
                        name="stock"
                        type="number"
                        min="0"
                        max="2147483647"
                        step="1"
                        defaultValue="0"
                        required
                      />
                    </label>
                  )}

                  <div className="actions">
                    <button type="submit" disabled={busy}>
                      {editing ? "Save changes" : "Add vehicle"}
                    </button>
                    {editing && (
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() => setEditing(null)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </section>
            )}

            <div className="results-heading">
              <h2>Available vehicles</h2>
              <span className="muted">{vehicles.length} results</span>
            </div>

            {vehicles.length === 0 ? (
              <section className="panel empty-state">
                <h3>No vehicles found</h3>
                <p>Try different filters{isAdmin ? " or add your first vehicle" : ""}.</p>
              </section>
            ) : (
              <section className="vehicle-grid" aria-label="Vehicle results" aria-busy={busy}>
                {vehicles.map((vehicle) => (
                  <article className="vehicle-card" key={vehicle.id}>
                    <div className="vehicle-banner">
                      <span>{vehicle.make}</span>
                      <span className="badge">{vehicle.category}</span>
                    </div>

                    <div className="vehicle-content">
                      <h3>
                        {vehicle.make} {vehicle.model}
                      </h3>
                      <p className="price">
                        {Number(vehicle.price).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <p className={vehicle.stock === 0 ? "stock sold-out" : "stock"}>
                        {vehicle.stock === 0 ? "Out of stock" : `${vehicle.stock} in stock`}
                      </p>

                      <button
                        disabled={busy || vehicle.stock === 0}
                        onClick={() =>
                          void mutate(
                            `/vehicles/${vehicle.id}/purchase`,
                            "POST",
                            undefined,
                            `${vehicle.make} ${vehicle.model} purchased.`,
                          )
                        }
                      >
                        {vehicle.stock === 0 ? "Out of stock" : "Purchase"}
                      </button>

                      {isAdmin && (
                        <div className="admin-controls">
                          <div className="actions">
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => {
                                setEditing(vehicle);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="danger"
                              disabled={busy}
                              onClick={() => {
                                if (window.confirm(`Delete ${vehicle.make} ${vehicle.model}?`)) {
                                  void mutate(
                                    `/vehicles/${vehicle.id}`,
                                    "DELETE",
                                    undefined,
                                    "Vehicle deleted.",
                                  ).then((deleted) => {
                                    if (deleted && editing?.id === vehicle.id) setEditing(null);
                                  });
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>

                          <form
                            className="restock-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              const data = new FormData(event.currentTarget);
                              void mutate(
                                `/vehicles/${vehicle.id}/restock`,
                                "POST",
                                { quantity: Number(text(data, "quantity")) },
                                "Stock updated.",
                              );
                            }}
                          >
                            <label>
                              Restock quantity
                              <input
                                name="quantity"
                                type="number"
                                min="1"
                                max="2147483647"
                                step="1"
                                defaultValue="1"
                                required
                              />
                            </label>
                            <button type="submit" className="secondary" disabled={busy}>
                              Restock
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </main>

      <footer>Car Dealership · Inventory management</footer>
    </div>
  );
}
