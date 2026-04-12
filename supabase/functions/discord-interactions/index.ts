import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DISCORD_API = 'https://discord.com/api/v10';

// Discord interaction types
const INTERACTION_PING = 1;
const INTERACTION_COMMAND = 2;
const RESPONSE_PONG = 1;
const RESPONSE_MESSAGE = 4;

async function discordRequest(endpoint: string, options: RequestInit, botToken: string) {
  const res = await fetch(`${DISCORD_API}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bot ${botToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord API error ${res.status}: ${text}`);
  }
  return res.json();
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
    if (!BOT_TOKEN) {
      return new Response('Bot token not configured', { status: 500 });
    }

    const interaction = await req.json();

    // Handle PING
    if (interaction.type === INTERACTION_PING) {
      return new Response(JSON.stringify({ type: RESPONSE_PONG }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Handle slash commands
    if (interaction.type === INTERACTION_COMMAND) {
      const { name, options } = interaction.data;
      const guildId = interaction.guild_id;
      const memberId = interaction.member?.user?.id;
      const isOwner = interaction.member?.permissions ? 
        (BigInt(interaction.member.permissions) & BigInt(0x8)) === BigInt(0x8) : false;

      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // /prices command
      if (name === 'prices') {
        const channelId = options?.find((o: any) => o.name === 'channel')?.value || interaction.channel_id;

        const { data: plans } = await supabaseClient
          .from('plans')
          .select('*')
          .eq('is_active', true)
          .order('sort_order');

        const fields = (plans || []).map((p: any) => ({
          name: `${p.is_free ? '🎁' : '⭐'} ${p.name}`,
          value: [
            `💰 ${p.price === 0 ? '**مجاني**' : `**$${p.price}/شهر**`}`,
            `💾 ${p.storage_mb >= 1024 ? `${p.storage_mb / 1024}GB` : `${p.storage_mb}MB`}`,
            `🧠 ${p.ram_mb >= 1024 ? `${p.ram_mb / 1024}GB` : `${p.ram_mb}MB`}`,
            `⚡ ${p.cpu_cores} نواة`,
          ].join('\n'),
          inline: true,
        }));

        // Send to specified channel
        await discordRequest(`/channels/${channelId}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            embeds: [{
              title: '🚀 Nova VPS - باقات الاستضافة',
              description: '🔗 **[اشترك الآن](https://novavps.app/plans)**',
              color: 0x8B5CF6,
              fields,
              footer: { text: 'Nova VPS' },
              timestamp: new Date().toISOString(),
            }]
          }),
        }, BOT_TOKEN);

        return new Response(JSON.stringify({
          type: RESPONSE_MESSAGE,
          data: { content: '✅ تم إرسال الأسعار بنجاح!', flags: 64 } // Ephemeral
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      // /serverinfo command
      if (name === 'serverinfo') {
        const guild = await discordRequest(`/guilds/${guildId}?with_counts=true`, { method: 'GET' }, BOT_TOKEN);

        return new Response(JSON.stringify({
          type: RESPONSE_MESSAGE,
          data: {
            embeds: [{
              title: `📊 معلومات السيرفر: ${guild.name}`,
              color: 0x8B5CF6,
              fields: [
                { name: '👥 الأعضاء', value: `${guild.approximate_member_count || 'غير متاح'}`, inline: true },
                { name: '🟢 متصل', value: `${guild.approximate_presence_count || 'غير متاح'}`, inline: true },
                { name: '📅 تاريخ الإنشاء', value: new Date(Number(BigInt(guild.id) >> BigInt(22)) + 1420070400000).toLocaleDateString('ar-SA'), inline: true },
                { name: '🆔 ID', value: guild.id, inline: true },
                { name: '👑 المالك', value: `<@${guild.owner_id}>`, inline: true },
                { name: '🔒 مستوى التحقق', value: ['بدون', 'منخفض', 'متوسط', 'عالي', 'أعلى'][guild.verification_level] || 'غير معروف', inline: true },
              ],
              thumbnail: guild.icon ? { url: `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` } : undefined,
            }],
            flags: 64,
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      // /stats command
      if (name === 'stats') {
        const [usersRes, projectsRes, subsRes] = await Promise.all([
          supabaseClient.from('profiles').select('id', { count: 'exact', head: true }),
          supabaseClient.from('projects').select('id', { count: 'exact', head: true }),
          supabaseClient.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        ]);

        return new Response(JSON.stringify({
          type: RESPONSE_MESSAGE,
          data: {
            embeds: [{
              title: '📈 إحصائيات Nova VPS',
              color: 0x8B5CF6,
              fields: [
                { name: '👥 المستخدمين', value: `${usersRes.count || 0}`, inline: true },
                { name: '🤖 المشاريع', value: `${projectsRes.count || 0}`, inline: true },
                { name: '⭐ اشتراكات فعالة', value: `${subsRes.count || 0}`, inline: true },
              ],
              footer: { text: 'Nova VPS Stats' },
              timestamp: new Date().toISOString(),
            }],
            flags: 64,
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      // /announce command
      if (name === 'announce') {
        const message = options?.find((o: any) => o.name === 'message')?.value;
        const channelId = options?.find((o: any) => o.name === 'channel')?.value || interaction.channel_id;

        await discordRequest(`/channels/${channelId}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            embeds: [{
              title: '📢 إعلان من Nova VPS',
              description: message,
              color: 0x8B5CF6,
              footer: { text: `بواسطة ${interaction.member?.user?.username || 'Admin'}` },
              timestamp: new Date().toISOString(),
            }]
          }),
        }, BOT_TOKEN);

        return new Response(JSON.stringify({
          type: RESPONSE_MESSAGE,
          data: { content: '✅ تم إرسال الإعلان!', flags: 64 }
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      // /status command (public)
      if (name === 'status') {
        return new Response(JSON.stringify({
          type: RESPONSE_MESSAGE,
          data: {
            embeds: [{
              title: '🟢 حالة Nova VPS',
              description: 'جميع الخدمات تعمل بشكل طبيعي',
              color: 0x22C55E,
              fields: [
                { name: '🌐 الموقع', value: '[novavps.app](https://novavps.app)', inline: true },
                { name: '⚡ الحالة', value: 'متصل', inline: true },
                { name: '📊 وقت التشغيل', value: '99.9%', inline: true },
              ],
              footer: { text: 'Nova VPS Status' },
              timestamp: new Date().toISOString(),
            }]
          }
        }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    return new Response(JSON.stringify({ type: RESPONSE_PONG }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Interaction error:', error);
    return new Response(JSON.stringify({
      type: RESPONSE_MESSAGE,
      data: { content: '❌ حدث خطأ في معالجة الأمر', flags: 64 }
    }), { headers: { 'Content-Type': 'application/json' } });
  }
});
