        if (text.startsWith('يوت ') || text.startsWith('بحث ')) {
            const query = text.replace(/^(يوت|بحث)\s+/, '').trim();
            if (!query) return ctx.reply('يرجى كتابة اسم الأغنية بعد الأمر.', { reply_to_message_id: ctx.message.message_id });

            const searchingMsg = await ctx.reply(`🔍 جاري البحث عن: [ ${query} ] ...`, { reply_to_message_id: ctx.message.message_id });

            try {
                const searchRes = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=1`);
                const data = await searchRes.json();

                if (data.results && data.results.length > 0) {
                    const track = data.results[0];
                    const audioUrl = track.previewUrl;
                    const trackName = track.trackName;
                    const artistName = track.artistName;
                    const durationMs = track.trackTimeMillis || 180000;
                    
                    const minutes = Math.floor(durationMs / 60000);
                    const seconds = ((durationMs % 60000) / 1000).toFixed(0);
                    const durationFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

                    const botUsername = ctx.botInfo ? ctx.botInfo.username : 'Toraif_bot';

                    try { await ctx.deleteMessage(searchingMsg.message_id); } catch (e) {}

                    if (audioUrl) {
                        // استخدام replyWithAudio مع تحديد title و performer يجعل تيليجرام يعرضها كمشغل موسيقي احترافي تماماً مثل مارفل
                        return ctx.replyWithAudio(audioUrl, {
                            title: trackName,
                            performer: artistName,
                            duration: Math.floor(durationMs / 1000),
                            caption: `• @${botUsername} ♪ ${durationFormatted}`,
                            parse_mode: 'Markdown',
                            reply_to_message_id: ctx.message.message_id
                        });
                    }
                }
                
                try { await ctx.deleteMessage(searchingMsg.message_id); } catch (e) {}
                return ctx.reply(`عذراً، لم أتمكن من العثور على الأغنية: "${query}".`, { reply_to_message_id: ctx.message.message_id });

            } catch (err) {
                try { await ctx.deleteMessage(searchingMsg.message_id); } catch (e) {}
                return ctx.reply('حدث خطأ أثناء البحث، حاول مرة أخرى.', { reply_to_message_id: ctx.message.message_id });
            }
        }
