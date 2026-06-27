import { PrismaClient } from '@prisma/client';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

// 1. SYSTEM CORES & IDENTITY MANAGERS
const prisma = (globalThis as any).prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') (globalThis as any).prisma = prisma;

const SECRET_KEY = new TextEncoder().encode('journal-system-secret-key-2026');

async function getUser() {
  const session = (await cookies()).get('session')?.value;
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, SECRET_KEY, { algorithms: ['HS256'] });
    return payload;
  } catch {
    return null;
  }
}

// 2. SERVER DATA OPERATIONS (BACKEND ENGINE)
async function handleAuth(formData: FormData) {
  'use server';
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const actionType = formData.get('actionType') as string;

  if (actionType === 'register') {
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const user = await prisma.user.create({ data: { email, password: hashedPassword } });
      const session = await new SignJWT({ userId: user.id, email: user.email }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('4h').sign(SECRET_KEY);
      (await cookies()).set('session', session, { httpOnly: true, secure: true });
    } catch {
      redirect('/?error=Account already exists');
    }
  } else {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) redirect('/?error=Wrong email or password');
    const session = await new SignJWT({ userId: user.id, email: user.email }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('4h').sign(SECRET_KEY);
    (await cookies()).set('session', session, { httpOnly: true, secure: true });
  }
  redirect('/');
}

async function handleLogout() {
  'use server';
  (await cookies()).delete('session');
  redirect('/');
}

async function createEntry(formData: FormData) {
  'use server';
  const user = await getUser();
  if (!user) return;

  await prisma.entry.create({
    data: {
      title: formData.get('title') as string || `Reflection - ${new Date().toLocaleDateString()}`,
      content: formData.get('content') as string,
      mood: formData.get('mood') as string,
      userId: user.userId as string,
    },
  });
  revalidatePath('/');
}

async function deleteEntry(entryId: string) {
  'use server';
  const user = await getUser();
  if (!user) return;

  await prisma.entry.delete({ where: { id: entryId } });
  revalidatePath('/');
}

// 3. SECURE WORKSPACE UI & MOOD MATRIX
export default async function DigitalJournalApp({ searchParams }: { searchParams: { error?: string, query?: string } }) {
  const user = await getUser();
  const error = searchParams?.error;
  const search = searchParams?.query || '';

  // Data fetching conditionally filtered by user session and search metrics
  const entries = user 
    ? await prisma.entry.findMany({ 
        where: { 
          userId: user.userId as string,
          OR: [
            { title: { contains: search } },
            { content: { contains: search } }
          ]
        }, 
        orderBy: { createdAt: 'desc' } 
      }) 
    : [];

  const moodIcons: Record<string, string> = {
    HAPPY: '☀️ Joyful',
    GRATEFUL: '🙏 Grateful',
    NEUTRAL: '🪵 Balanced',
    STRESSED: '⛈️ Overwhelmed',
    SAD: '🌧️ Reflective',
  };

  const moodBgs: Record<string, string> = {
    HAPPY: 'bg-amber-50 text-amber-700 border-amber-200',
    GRATEFUL: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    NEUTRAL: 'bg-slate-50 text-slate-700 border-slate-200',
    STRESSED: 'bg-rose-50 text-rose-700 border-rose-200',
    SAD: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  };

  return (
    <div className="max-w-4xl mx-auto p-6 font-sans antialiased">
      {/* Brand Header */}
      <header className="flex justify-between items-center mb-10 border-b pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">MindLog</h1>
          <p className="text-stone-500 text-sm">Secure Private Reflection Vault</p>
        </div>
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold bg-stone-100 px-3 py-1.5 rounded text-stone-700">🔒 Vault Signed In</span>
            <form action={handleLogout}><button className="text-xs text-red-500 font-bold hover:underline">Lock Vault</button></form>
          </div>
        ) : (
          <span className="text-xs text-stone-400">Unlock secure storage container to view logs</span>
        )}
      </header>

      {/* Security Gate Form */}
      {!user && (
        <div className="bg-white p-8 rounded-xl border border-stone-200 shadow-sm mb-10 max-w-sm mx-auto">
          <h2 className="text-lg font-bold mb-4 text-center text-stone-800">Decryption Matrix</h2>
          {error && <p className="text-red-500 text-xs text-center mb-3 font-medium">{error}</p>}
          <form action={handleAuth} className="space-y-3">
            <input name="email" type="email" placeholder="Identifier Email" required className="w-full p-2.5 border rounded text-xs bg-stone-50/50" />
            <input name="password" type="password" placeholder="Passkey Signature" required className="w-full p-2.5 border rounded text-xs bg-stone-50/50" />
            <div className="flex gap-2 pt-2">
              <button name="actionType" value="login" type="submit" className="flex-1 bg-stone-900 text-white p-2 rounded text-xs font-bold hover:bg-stone-800 transition-colors">Decrypt</button>
              <button name="actionType" value="register" type="submit" className="flex-1 bg-stone-100 text-stone-700 p-2 rounded text-xs font-bold hover:bg-stone-200 transition-colors">Initialize</button>
            </div>
          </form>
        </div>
      )}

      {user && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Form Composer Column */}
          <div className="md:col-span-1">
            <form action={createEntry} className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm sticky top-6 space-y-4">
              <h3 className="font-bold text-sm text-stone-800 border-b pb-2">New Reflection</h3>
              
              <div>
                <label className="block text-[10px] font-bold uppercase text-stone-400 mb-1">Title</label>
                <input name="title" placeholder="Daily Reflection" className="w-full p-2 border border-stone-200 rounded text-xs focus:outline-stone-400" />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-stone-400 mb-1">Current Mood Profile</label>
                <select name="mood" className="w-full p-2 border border-stone-200 rounded text-xs bg-white text-stone-700">
                  <option value="NEUTRAL">🪵 Balanced / Neutral</option>
                  <option value="HAPPY">☀️ Joyful / Energized</option>
                  <option value="GRATEFUL">🙏 Peaceful / Grateful</option>
                  <option value="STRESSED">⛈️ Overwhelmed / Busy</option>
                  <option value="SAD">🌧️ Low Energy / Reflective</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-stone-400 mb-1">Thoughts & Context</label>
                <textarea name="content" required placeholder="Write down honest internal dialogue..." rows={6} className="w-full p-2 border border-stone-200 rounded text-xs focus:outline-stone-400 whitespace-pre-wrap" />
              </div>

              <button type="submit" className="w-full bg-stone-900 text-white py-2 rounded text-xs font-bold hover:bg-stone-800 transition-colors">Commit to Memory</button>
            </form>
          </div>

          {/* Timeline Feed Column */}
          <div className="md:col-span-2 space-y-4">
            {/* Context Search Utility */}
            <form method="GET" className="flex gap-2">
              <input 
                name="query" 
                type="text" 
                defaultValue={search}
                placeholder="🔍 Search past logs by keyword context..." 
                className="flex-1 p-2 border border-stone-200 rounded-lg text-xs bg-white focus:outline-none" 
              />
              {search && <a href="/" className="p-2 border rounded-lg text-xs text-stone-500 bg-stone-50 hover:bg-stone-100">Reset</a>}
              <button type="submit" className="bg-stone-100 border text-stone-700 font-bold px-3 py-2 rounded-lg text-xs hover:bg-stone-200">Search</button>
            </form>

            {/* Displaying Timeline Iterations */}
            <div className="space-y-4">
              {entries.length === 0 ? (
                <div className="text-center p-12 border border-dashed rounded-xl bg-stone-50/50">
                  <p className="text-xs text-stone-400">No chronological logs align with your account context or query.</p>
                </div>
              ) : (
                entries.map((entry: any) => (
                  <div key={entry.id} className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm relative group hover:border-stone-300 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-sm text-stone-900">{entry.title}</h4>
                        <span className="text-[10px] text-stone-400 tracking-tight font-medium">
                          🗓️ {new Date(entry.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 border rounded-md ${moodBgs[entry.mood]}`}>
                        {moodIcons[entry.mood]}
                      </span>
                    </div>

                    <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-wrap pt-2 border-t border-stone-50">
                      {entry.content}
                    </p>

                    <form action={deleteEntry.bind(null, entry.id)} className="absolute top-4 right-4 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="submit" className="text-stone-300 hover:text-red-500 text-xs p-1">🗑️</button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
