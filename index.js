const express = require('express');
const { exec } = require('child_process');
const app = express();
const port = 3000;

app.use(express.static('public'));

// Ruta para ejecutar el bot
app.get('/start-bot', (req, res) => {
    exec('node node index.js', (err, stdout, stderr) => {
        if (err) {
            console.error(`Error ejecutando el bot: ${err}`);
            res.status(500).send('Error al iniciar el bot.');
            return;
        }
        console.log(`Bot iniciado: ${stdout}`);
        res.send('Bot iniciado correctamente.');
    });
});

app.listen(port, () => {
    console.log(`Servidor escuchando en http://localhost:${port}`);
});


const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, Events } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const config = require('./config.json');
require('dotenv').config();
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates],
    partials: [Partials.Channel],
});

const queue = new Map();

client.once('ready', () => {
    console.log("El Bot está encendido");
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (message.content === 'hola') {
        message.reply({ content: "Picate la cola mejor" });
    }
    if (message.content === 'valo') {
        message.reply({ content: "@everyone Saquen el valo" });
    }
    if (message.content === 'fort') {
        message.reply({ content: "@everyone Saquen el fortnite" });
    }
    if (message.content === 'chupi') {
        message.reply({ content: "@everyone HOY SE BEBE, PREPARENSE PARA EL CHUPI" });
    }
    if (message.content === 'cs') {
        message.reply({ content: "@everyone Saca el counter" });
    }

 

    if (message.content.startsWith('!play')) {
        const args = message.content.split(' ');
        if (!args[1]) return message.reply('Por favor proporciona un enlace de YouTube.');

        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('¡Debes estar en un canal de voz para reproducir música!');

        const serverQueue = queue.get(message.guild.id);
        const songInfo = await ytdl.getInfo(args[1]);
        const song = {
            title: songInfo.videoDetails.title,
            url: songInfo.videoDetails.video_url
        };

        if (!serverQueue) {
            const queueConstruct = {
                textChannel: message.channel,
                voiceChannel: voiceChannel,
                connection: null,
                songs: [],
                player: createAudioPlayer()
            };

            queue.set(message.guild.id, queueConstruct);
            queueConstruct.songs.push(song);

            try {
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });

                queueConstruct.connection = connection;
                playSong(message.guild, queueConstruct.songs[0]);
            } catch (err) {
                console.error(err);
                queue.delete(message.guild.id);
                return message.channel.send(err.message);
            }
        } else {
            serverQueue.songs.push(song);
            return message.channel.send(`${song.title} ha sido añadido a la cola.`);
        }
        
    }
});

const fs = require('fs');
const path = require('path');

async function playSong(guild, song) {
    const serverQueue = queue.get(guild.id);
    if (!serverQueue || !song) {
        if (serverQueue?.connection) serverQueue.connection.destroy();
        queue.delete(guild.id);
        return;
    }

    try {
        const stream = ytdl(song.url, {
            filter: 'audioonly',
            highWaterMark: 1 << 25,
            quality: 'highestaudio',
            requestOptions: {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0',
                    'cookie': 'VISITOR_INFO1_LIVE=your-cookie-value',
                }
            }
        });

        const resource = createAudioResource(stream, { inlineVolume: true });
        stream.on('error', (err) => {
            console.error('Error en el stream:', err);
            serverQueue.songs.shift();
            playSong(guild, serverQueue.songs[0]);
        });

        serverQueue.player.play(resource);
        serverQueue.connection.subscribe(serverQueue.player);

        const buttons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('pause')
                    .setLabel('⏸️Pausar')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('resume')
                    .setLabel('▶️ Reanudar')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('skip')
                    .setLabel('⏭️ Saltar')
                    .setStyle(ButtonStyle.Danger),
            );

        await serverQueue.textChannel.send({ content: `Reproduciendo ahora: ${song.title}`, components: [buttons] });

    } catch (err) {
        console.error('Error al reproducir la canción:', err.message);
        serverQueue.songs.shift();
        playSong(guild, serverQueue.songs[0]);
    }
}


client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    const serverQueue = queue.get(interaction.guildId);
    if (!serverQueue) return interaction.reply({ content: 'No hay canciones en la cola.', ephemeral: true });

    switch (interaction.customId) {
        case 'pause':
            serverQueue.player.pause();
            await interaction.reply({ content: 'Canción pausada.' });
            break;
        case 'resume':
            serverQueue.player.unpause();
            await interaction.reply({ content: 'Canción reanudada.' });
            break;
            case 'skip':
                serverQueue.songs.shift(); // Avanzar a la siguiente canción
                playSong(interaction.guild, serverQueue.songs[0]); // Reproducir la siguiente
                await interaction.reply({ content: 'Canción saltada.' });
                break;
    }
});

// Manejador global de errores para evitar que el bot truene
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

client.login(config.token);
