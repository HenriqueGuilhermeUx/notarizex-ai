const fetch = require('node-fetch');
const FormData = require('form-data');
const crypto = require('crypto');
const { scrapeWebsite } = require('./lib/scraper');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, RESEND_API_KEY, MERCADOPAGO_ACCESS_TOKEN } = process.env;

    try {
        const fields = JSON.parse(event.body);
        const { name, email, whatsapp, companyName, website, contentOptions, manualText, fileData, fileName } = fields;

        console.log('[Website Bot Onboarding] Iniciando processo para:', email);
        console.log('[Website Bot Onboarding] Opções de conteúdo:', contentOptions);

        // Validar que pelo menos uma opção foi escolhida
        if (!contentOptions || contentOptions.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Escolha pelo menos uma opção de conteúdo' })
            };
        }

        // Array para armazenar os file IDs da OpenAI
        const fileIds = [];
        let combinedContent = `Informações sobre ${companyName}\nSite: ${website}\n\n`;

        // 1. PROCESSAR WEB SCRAPING
        if (contentOptions.includes('scraping')) {
            console.log('[Website Bot Onboarding] Processando web scraping...');
            try {
                const scrapedContent = await scrapeWebsite(website);
                combinedContent += `\n## Conteúdo extraído do site:\n\n${scrapedContent}\n\n`;
                console.log('[Website Bot Onboarding] Web scraping concluído. Caracteres:', scrapedContent.length);
            } catch (error) {
                console.error('[Website Bot Onboarding] Erro no scraping:', error.message);
                // Continuar mesmo se o scraping falhar
                combinedContent += `\n## Nota: Não foi possível extrair conteúdo automaticamente do site.\n\n`;
            }
        }

        // 2. PROCESSAR TEXTO MANUAL
        if (contentOptions.includes('text') && manualText) {
            console.log('[Website Bot Onboarding] Processando texto manual...');
            combinedContent += `\n## Informações fornecidas manualmente:\n\n${manualText}\n\n`;
        }

        // 3. PROCESSAR PDF (se fornecido)
        if (contentOptions.includes('pdf') && fileData && fileName) {
            console.log('[Website Bot Onboarding] Processando PDF...');
            try {
                const fileBuffer = Buffer.from(fileData, 'base64');
                const formData = new FormData();
                formData.append('file', fileBuffer, { filename: fileName, contentType: 'application/pdf' });
                formData.append('purpose', 'assistants');

                const uploadResponse = await fetch('https://api.openai.com/v1/files', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
                    body: formData
                });

                if (!uploadResponse.ok) {
                    throw new Error('Falha ao fazer upload do PDF para OpenAI');
                }

                const uploadData = await uploadResponse.json();
                fileIds.push(uploadData.id);
                console.log('[Website Bot Onboarding] PDF enviado:', uploadData.id);
            } catch (error) {
                console.error('[Website Bot Onboarding] Erro no upload do PDF:', error.message);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: 'Falha ao processar PDF: ' + error.message })
                };
            }
        }

        // 4. CRIAR PDF COM CONTEÚDO COMBINADO (scraping + texto manual)
        if (contentOptions.includes('scraping') || contentOptions.includes('text')) {
            console.log('[Website Bot Onboarding] Criando PDF com conteúdo combinado...');
            try {
                // Criar PDF com pdf-lib
                const pdfDoc = await PDFDocument.create();
                const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                
                // Dividir conteúdo em linhas
                const lines = combinedContent.split('\n');
                let currentPage = pdfDoc.addPage([595, 842]); // A4
                let yPosition = 800;
                const margin = 50;
                const lineHeight = 14;
                const maxWidth = 495; // 595 - 2*margin

                for (const line of lines) {
                    // Quebrar linha se for muito longa
                    const words = line.split(' ');
                    let currentLine = '';
                    
                    for (const word of words) {
                        const testLine = currentLine + word + ' ';
                        const textWidth = font.widthOfTextAtSize(testLine, 10);
                        
                        if (textWidth > maxWidth && currentLine !== '') {
                            // Desenhar linha atual
                            const isHeading = currentLine.startsWith('#');
                            const useFont = isHeading ? boldFont : font;
                            const fontSize = isHeading ? 12 : 10;
                            
                            currentPage.drawText(currentLine.trim(), {
                                x: margin,
                                y: yPosition,
                                size: fontSize,
                                font: useFont,
                                color: rgb(0, 0, 0)
                            });
                            
                            yPosition -= lineHeight;
                            currentLine = word + ' ';
                            
                            // Nova página se necessário
                            if (yPosition < 50) {
                                currentPage = pdfDoc.addPage([595, 842]);
                                yPosition = 800;
                            }
                        } else {
                            currentLine = testLine;
                        }
                    }
                    
                    // Desenhar última linha
                    if (currentLine.trim() !== '') {
                        const isHeading = currentLine.startsWith('#');
                        const useFont = isHeading ? boldFont : font;
                        const fontSize = isHeading ? 12 : 10;
                        
                        currentPage.drawText(currentLine.trim(), {
                            x: margin,
                            y: yPosition,
                            size: fontSize,
                            font: useFont,
                            color: rgb(0, 0, 0)
                        });
                    }
                    
                    yPosition -= lineHeight;
                    
                    // Nova página se necessário
                    if (yPosition < 50) {
                        currentPage = pdfDoc.addPage([595, 842]);
                        yPosition = 800;
                    }
                }

                // Salvar PDF
                const pdfBytes = await pdfDoc.save();
                
                // Upload para OpenAI
                const formData = new FormData();
                formData.append('file', Buffer.from(pdfBytes), { 
                    filename: `${companyName.replace(/[^a-z0-9]/gi, '_')}_content.pdf`, 
                    contentType: 'application/pdf' 
                });
                formData.append('purpose', 'assistants');

                const uploadResponse = await fetch('https://api.openai.com/v1/files', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
                    body: formData
                });

                if (!uploadResponse.ok) {
                    throw new Error('Falha ao fazer upload do PDF gerado para OpenAI');
                }

                const uploadData = await uploadResponse.json();
                fileIds.push(uploadData.id);
                console.log('[Website Bot Onboarding] PDF gerado enviado:', uploadData.id);
            } catch (error) {
                console.error('[Website Bot Onboarding] Erro ao criar PDF:', error.message);
                // Continuar mesmo se falhar
            }
        }

        // Verificar se temos pelo menos um arquivo
        if (fileIds.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Nenhum conteúdo foi processado com sucesso. Tente novamente.' })
            };
        }

        console.log('[Website Bot Onboarding] Total de arquivos processados:', fileIds.length);

        // 5. CRIAR ASSISTENTE NA OPENAI
        const assistantResponse = await fetch('https://api.openai.com/v1/assistants', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                'OpenAI-Beta': 'assistants=v2'
            },
            body: JSON.stringify({
                name: `Assistente de ${companyName}`,
                instructions: `Você é o assistente virtual da ${companyName} (${website}).

Use os arquivos fornecidos como base de conhecimento para responder perguntas sobre produtos e serviços.

Seu objetivo é:
1. Responder perguntas de forma educada e prestativa
2. Fornecer informações precisas sobre produtos/serviços
3. Direcionar o visitante para ações de conversão (compra, contato, agendamento)
4. Ser objetivo e direto nas respostas
5. Se não souber a resposta, seja honesto e sugira entrar em contato

Sempre mantenha um tom profissional e amigável.

IMPORTANTE: Sempre que mencionar preços, produtos ou serviços, baseie-se EXCLUSIVAMENTE nas informações dos arquivos fornecidos. Não invente informações.`,
                model: 'gpt-4o-mini',
                tools: [{ type: 'file_search' }],
                tool_resources: {
                    file_search: {
                        vector_stores: [{
                            file_ids: fileIds
                        }]
                    }
                }
            })
        });

        if (!assistantResponse.ok) {
            const errorData = await assistantResponse.json();
            console.error('[Website Bot Onboarding] Erro ao criar assistente:', errorData);
            throw new Error('Falha ao criar assistente na OpenAI');
        }

        const assistantData = await assistantResponse.json();
        const assistantId = assistantData.id;
        console.log('[Website Bot Onboarding] Assistente criado:', assistantId);

        // 6. GERAR BOT ID ÚNICO
        const botId = crypto.randomBytes(16).toString('hex');

        // 7. CRIAR LINK DE PAGAMENTO NO MERCADO PAGO
        const paymentResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                items: [{
                    title: 'SmartBots - Bot para Site',
                    quantity: 1,
                    unit_price: 79.00,
                    currency_id: 'BRL'
                }],
                payer: { email, name },
                back_urls: {
                    success: `https://smartbots.club/dashboard?status=success&botId=${botId}`,
                    failure: 'https://smartbots.club?status=failure',
                    pending: 'https://smartbots.club?status=pending'
                },
                auto_return: 'approved',
                notification_url: 'https://smartbots.club/.netlify/functions/payment-webhook',
                external_reference: botId
            })
        });

        if (!paymentResponse.ok) {
            throw new Error('Falha ao criar link de pagamento');
        }

        const paymentData = await paymentResponse.json();
        const paymentLink = paymentData.init_point;
        console.log('[Website Bot Onboarding] Link de pagamento criado');

        // 8. SALVAR NO SUPABASE
        const supabaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/website_bots`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                bot_id: botId,
                owner_name: name,
                owner_email: email,
                owner_whatsapp: whatsapp,
                company_name: companyName,
                website: website,
                assistant_id: assistantId,
                file_ids: fileIds.join(','),
                content_options: contentOptions.join(','),
                payment_link: paymentLink,
                status: 'pending_payment',
                created_at: new Date().toISOString()
            })
        });

        if (!supabaseResponse.ok) {
            console.error('[Website Bot Onboarding] Erro ao salvar no Supabase');
        } else {
            console.log('[Website Bot Onboarding] Bot salvo no Supabase');
        }

        // 9. ENVIAR NOTIFICAÇÃO POR E-MAIL
        const contentSummary = contentOptions.map(opt => {
            if (opt === 'scraping') return '✅ Web Scraping';
            if (opt === 'pdf') return '✅ Upload de PDF';
            if (opt === 'text') return '✅ Texto Manual';
            return opt;
        }).join(', ');

        const emailContent = `
Novo cliente cadastrado no SmartBots - Bot para Site!

Nome: ${name}
E-mail: ${email}
WhatsApp: ${whatsapp}
Empresa: ${companyName}
Website: ${website}

Opções de Conteúdo: ${contentSummary}

Bot ID: ${botId}
Assistente ID: ${assistantId}
Arquivos: ${fileIds.join(', ')}
Link de Pagamento: ${paymentLink}

Status: Aguardando pagamento (R$ 79/mês)
        `;

        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`
            },
            body: JSON.stringify({
                from: 'SmartBots <noreply@smartbots.club>',
                to: 'henriquecampos66@gmail.com',
                subject: `Novo Cliente Bot para Site: ${companyName}`,
                text: emailContent
            })
        });

        console.log('[Website Bot Onboarding] E-mail enviado');

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Bot criado com sucesso!',
                botId,
                assistantId,
                paymentLink,
                filesProcessed: fileIds.length
            })
        };

    } catch (error) {
        console.error('[Website Bot Onboarding] Erro:', error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
