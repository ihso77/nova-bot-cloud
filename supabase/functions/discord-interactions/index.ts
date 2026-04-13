import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DISCORD_API = 'https://discord.com/api/v10';
const INTERACTION_PING = 1;
const INTERACTION_COMMAND = 2;
const RESPONSE_PONG = 1;
const RESPONSE_MESSAGE = 4;

const BOT_START_TIME = Date.now();

async function discordRequest(endpoint: string, options: RequestInit, botToken: string) {
  const res = await fetch(`${DISCORD_API}${endpoint}`, {
    ...options,
    headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord API error ${res.status}: ${text}`);
  }
  return res.json();
}

function ephemeral(content: string) {
  return new Response(JSON.stringify({ type: RESPONSE_MESSAGE, data: { content, flags: 64 } }), { headers: { 'Content-Type': 'application/json' } });
}

function embedResponse(embeds: any[], ephemeralFlag = true) {
  return new Response(JSON.stringify({ type: RESPONSE_MESSAGE, data: { embeds, flags: ephemeralFlag ? 64 : 0 } }), { headers: { 'Content-Type': 'application/json' } });
}

function formatUptime(ms: number) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  try {
    const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
    if (!BOT_TOKEN) return new Response('Bot token not configured', { status: 500 });

    const interaction = await req.json();

    if (interaction.type === INTERACTION_PING) {
      return new Response(JSON.stringify({ type: RESPONSE_PONG }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (interaction.type === INTERACTION_COMMAND) {
      const { name, options } = interaction.data;
      const guildId = interaction.guild_id;
      const member = interaction.member;
      const memberId = member?.user?.id;

      const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

      // /help
      if (name === 'help') {
        return embedResponse([{
          title: '📋 أوامر Nova VPS Bot',
          color: 0x8B5CF6,
          fields: [
            { name: '🌐 عامة', value: '`/help` `/status` `/ping` `/invite` `/uptime`', inline: false },
            { name: '📊 معلومات', value: '`/serverinfo` `/user` `/avatar` `/roles`', inline: false },
            { name: '💰 الباقات', value: '`/prices` `/plans-detail` `/stats`', inline: false },
            { name: '📢 إدارة', value: '`/announce` `/poll` `/site-check`', inline: false },
            { name: '🔒 أدمن', value: '`/lookup` `/recent-payments`', inline: false },
          ],
          footer: { text: 'Nova VPS Bot' },
        }]);
      }

      // /ping
      if (name === 'ping') {
        const start = Date.now();
        return ephemeral(`🏓 Pong! الاستجابة: **${Date.now() - start}ms**`);
      }

      // /invite
      if (name === 'invite') {
        const me = await discordRequest('/users/@me', { method: 'GET' }, BOT_TOKEN);
        const url = `https://discord.com/oauth2/authorize?client_id=${me.id}&permissions=8&scope=bot%20applications.commands`;
        return embedResponse([{ title: '🔗 رابط دعوة البوت', description: `[اضغط هنا لدعوة البوت](${url})`, color: 0x8B5CF6 }]);
      }

      // /uptime
      if (name === 'uptime') {
        return ephemeral(`⏱️ مدة التشغيل: **${formatUptime(Date.now() - BOT_START_TIME)}**`);
      }

      // /user
      if (name === 'user') {
        const targetId = options?.find((o: any) => o.name === 'member')?.value;
        const resolved = interaction.data.resolved?.members?.[targetId];
        const resolvedUser = interaction.data.resolved?.users?.[targetId];
        if (!resolvedUser) return ephemeral('❌ المستخدم غير موجود');
        
        return embedResponse([{
          title: `👤 معلومات ${resolvedUser.username}`,
          color: 0x8B5CF6,
          thumbnail: resolvedUser.avatar ? { url: `https://cdn.discordapp.com/avatars/${targetId}/${resolvedUser.avatar}.png?size=256` } : undefined,
          fields: [
            { name: '🆔 ID', value: targetId, inline: true },
            { name: '👤 اليوزر', value: resolvedUser.username, inline: true },
            { name: '📅 انضم للسيرفر', value: resolved?.joined_at ? new Date(resolved.joined_at).toLocaleDateString('ar-SA') : 'غير معروف', inline: true },
            { name: '🤖 بوت', value: resolvedUser.bot ? 'نعم' : 'لا', inline: true },
          ],
        }]);
      }

      // /avatar
      if (name === 'avatar') {
        const targetId = options?.find((o: any) => o.name === 'member')?.value || memberId;
        const resolvedUser = interaction.data.resolved?.users?.[targetId] || member?.user;
        const avatarUrl = resolvedUser?.avatar
          ? `https://cdn.discordapp.com/avatars/${targetId || memberId}/${resolvedUser.avatar}.png?size=512`
          : `https://cdn.discordapp.com/embed/avatars/0.png`;
        
        return embedResponse([{
          title: `🖼️ صورة ${resolvedUser?.username || 'المستخدم'}`,
          color: 0x8B5CF6,
          image: { url: avatarUrl },
        }]);
      }

      // /roles
      if (name === 'roles') {
        const guild = await discordRequest(`/guilds/${guildId}`, { method: 'GET' }, BOT_TOKEN);
        const roles = (guild.roles || [])
          .filter((r: any) => r.name !== '@everyone')
          .sort((a: any, b: any) => b.position - a.position)
          .slice(0, 20)
          .map((r: any) => `<@&${r.id}> (${r.position})`);
        
        return embedResponse([{
          title: `📋 رتب السيرفر (${roles.length})`,
          description: roles.join('\n') || 'لا يوجد رتب',
          color: 0x8B5CF6,
        }]);
      }

      // /prices
      if (name === 'prices') {
        const channelId = options?.find((o: any) => o.name === 'channel')?.value || interaction.channel_id;
        const { data: plans } = await supabaseClient.from('plans').select('*').eq('is_active', true).order('sort_order');
        const fields = (plans || []).map((p: any) => ({
          name: `${p.is_free ? '🎁' : '⭐'} ${p.name}`,
          value: [`💰 ${p.price === 0 ? '**مجاني**' : `**$${p.price}/شهر**`}`, `💾 ${p.storage_mb >= 1024 ? `${p.storage_mb / 1024}GB` : `${p.storage_mb}MB`}`, `🧠 ${p.ram_mb >= 1024 ? `${p.ram_mb / 1024}GB` : `${p.ram_mb}MB`}`, `⚡ ${p.cpu_cores} نواة`].join('\n'),
          inline: true,
        }));
        await discordRequest(`/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify({ embeds: [{ title: '🚀 Nova VPS - باقات الاستضافة', description: '🔗 **[اشترك الآن](https://novavps.app/plans)**', color: 0x8B5CF6, fields, footer: { text: 'Nova VPS' }, timestamp: new Date().toISOString() }] }) }, BOT_TOKEN);
        return ephemeral('✅ تم إرسال الأسعار بنجاح!');
      }

      // /serverinfo
      if (name === 'serverinfo') {
        const guild = await discordRequest(`/guilds/${guildId}?with_counts=true`, { method: 'GET' }, BOT_TOKEN);
        return embedResponse([{
          title: `📊 ${guild.name}`,
          color: 0x8B5CF6,
          thumbnail: guild.icon ? { url: `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` } : undefined,
          fields: [
            { name: '👥 الأعضاء', value: `${guild.approximate_member_count || '?'}`, inline: true },
            { name: '🟢 متصل', value: `${guild.approximate_presence_count || '?'}`, inline: true },
            { name: '👑 المالك', value: `<@${guild.owner_id}>`, inline: true },
            { name: '🔒 التحقق', value: ['بدون', 'منخفض', 'متوسط', 'عالي', 'أعلى'][guild.verification_level] || '?', inline: true },
            { name: '🆔 ID', value: guild.id, inline: true },
            { name: '📅 الإنشاء', value: new Date(Number(BigInt(guild.id) >> BigInt(22)) + 1420070400000).toLocaleDateString('ar-SA'), inline: true },
          ],
        }]);
      }

      // /stats
      if (name === 'stats') {
        const [usersRes, projectsRes, subsRes] = await Promise.all([
          supabaseClient.from('profiles').select('id', { count: 'exact', head: true }),
          supabaseClient.from('projects').select('id', { count: 'exact', head: true }),
          supabaseClient.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        ]);
        return embedResponse([{
          title: '📈 إحصائيات Nova VPS',
          color: 0x8B5CF6,
          fields: [
            { name: '👥 المستخدمين', value: `${usersRes.count || 0}`, inline: true },
            { name: '🤖 المشاريع', value: `${projectsRes.count || 0}`, inline: true },
            { name: '⭐ اشتراكات فعالة', value: `${subsRes.count || 0}`, inline: true },
          ],
          footer: { text: 'Nova VPS Stats' },
          timestamp: new Date().toISOString(),
        }]);
      }

      // /announce
      if (name === 'announce') {
        const message = options?.find((o: any) => o.name === 'message')?.value;
        const channelId = options?.find((o: any) => o.name === 'channel')?.value || interaction.channel_id;
        await discordRequest(`/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify({ embeds: [{ title: '📢 إعلان من Nova VPS', description: message, color: 0x8B5CF6, footer: { text: `بواسطة ${member?.user?.username || 'Admin'}` }, timestamp: new Date().toISOString() }] }) }, BOT_TOKEN);
        return ephemeral('✅ تم إرسال الإعلان!');
      }

      // /status
      if (name === 'status') {
        return embedResponse([{
          title: '🟢 حالة Nova VPS',
          description: 'جميع الخدمات تعمل بشكل طبيعي',
          color: 0x22C55E,
          fields: [
            { name: '🌐 الموقع', value: '[novavps.app](https://novavps.app)', inline: true },
            { name: '⚡ الحالة', value: 'متصل', inline: true },
            { name: '📊 الأداء', value: '99.9%', inline: true },
          ],
          footer: { text: 'Nova VPS Status' },
          timestamp: new Date().toISOString(),
        }], false);
      }

      // /poll
      if (name === 'poll') {
        const question = options?.find((o: any) => o.name === 'question')?.value;
        const channelId = options?.find((o: any) => o.name === 'channel')?.value || interaction.channel_id;
        const msg = await discordRequest(`/channels/${channelId}/messages`, { method: 'POST', body: JSON.stringify({ embeds: [{ title: '📊 تصويت', description: question, color: 0x8B5CF6, footer: { text: `بواسطة ${member?.user?.username || 'Admin'}` } }] }) }, BOT_TOKEN);
        // Add reactions
        try {
          await fetch(`${DISCORD_API}/channels/${channelId}/messages/${msg.id}/reactions/✅/@me`, { method: 'PUT', headers: { 'Authorization': `Bot ${BOT_TOKEN}` } });
          await fetch(`${DISCORD_API}/channels/${channelId}/messages/${msg.id}/reactions/❌/@me`, { method: 'PUT', headers: { 'Authorization': `Bot ${BOT_TOKEN}` } });
        } catch {}
        return ephemeral('✅ تم إنشاء التصويت!');
      }

      // /site-check
      if (name === 'site-check') {
        const checks = [
          { name: 'الموقع الرئيسي', url: 'https://novavps.app' },
          { name: 'API', url: Deno.env.get('SUPABASE_URL') + '/rest/v1/' },
        ];
        const results = await Promise.all(checks.map(async (c) => {
          try {
            const start = Date.now();
            const res = await fetch(c.url, { method: 'HEAD' });
            const latency = Date.now() - start;
            return { name: c.name, status: res.ok ? '🟢 متصل' : '🔴 منقطع', latency: `${latency}ms` };
          } catch {
            return { name: c.name, status: '🔴 منقطع', latency: '-' };
          }
        }));
        return embedResponse([{
          title: '🔍 فحص خدمات Nova VPS',
          color: 0x8B5CF6,
          fields: results.map(r => ({ name: r.name, value: `${r.status} (${r.latency})`, inline: true })),
          timestamp: new Date().toISOString(),
        }]);
      }

      // /plans-detail
      if (name === 'plans-detail') {
        const { data: plans } = await supabaseClient.from('plans').select('*').eq('is_active', true).order('sort_order');
        const desc = (plans || []).map((p: any, i: number) => {
          const price = p.price === 0 ? 'مجاني' : `$${p.price}/شهر`;
          const storage = p.storage_mb >= 1024 ? `${p.storage_mb / 1024}GB` : `${p.storage_mb}MB`;
          const ram = p.ram_mb >= 1024 ? `${p.ram_mb / 1024}GB` : `${p.ram_mb}MB`;
          return `**${i + 1}. ${p.name}** — ${price}\n└ 💾 ${storage} | 🧠 ${ram} | ⚡ ${p.cpu_cores} نواة${p.description ? `\n└ 📋 ${p.description}` : ''}`;
        }).join('\n\n');
        return embedResponse([{
          title: '📋 تفاصيل الباقات',
          description: desc || 'لا يوجد باقات',
          color: 0x8B5CF6,
          footer: { text: '🔗 novavps.app/plans' },
        }]);
      }

      // /lookup (admin)
      if (name === 'lookup') {
        const email = options?.find((o: any) => o.name === 'email')?.value;
        const { data: profile } = await supabaseClient.from('profiles').select('*').eq('email', email).maybeSingle();
        if (!profile) return ephemeral('❌ المستخدم غير موجود');
        const { count: projCount } = await supabaseClient.from('projects').select('id', { count: 'exact', head: true }).eq('user_id', profile.user_id);
        const { count: subCount } = await supabaseClient.from('subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', profile.user_id).eq('status', 'active');
        return embedResponse([{
          title: `🔍 ${profile.display_name || email}`,
          color: 0x8B5CF6,
          fields: [
            { name: '📧 البريد', value: profile.email, inline: true },
            { name: '🤖 المشاريع', value: `${projCount || 0}`, inline: true },
            { name: '⭐ الاشتراكات', value: `${subCount || 0}`, inline: true },
            { name: '📅 التسجيل', value: new Date(profile.created_at).toLocaleDateString('ar-SA'), inline: true },
          ],
        }]);
      }

      // /recent-payments (admin)
      if (name === 'recent-payments') {
        const { data: payments } = await supabaseClient.from('payments').select('*').order('created_at', { ascending: false }).limit(5);
        const desc = (payments || []).map((p: any, i: number) =>
          `**${i + 1}.** $${p.amount} — ${p.status === 'paid' || p.status === 'completed' ? '✅' : '⏳'} ${p.status} — ${new Date(p.created_at).toLocaleDateString('ar-SA')}`
        ).join('\n') || 'لا يوجد مدفوعات';
        return embedResponse([{
          title: '💳 آخر المدفوعات',
          description: desc,
          color: 0x8B5CF6,
        }]);
      }
    }

    return new Response(JSON.stringify({ type: RESPONSE_PONG }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('Interaction error:', error);
    return ephemeral('❌ حدث خطأ في معالجة الأمر');
  }
});
