const puppeteer = require("puppeteer");
const getUuid = require("uuid-by-string");
const moment = require("moment");
const toCSV = require("./helpers/saveToCSV");
const helpers = require("./helpers/string");
const { delay } = require("./helpers/string");
const { makeDirectory } = require("./helpers/saveToPDF");

(async () => {
    const ano ='2022'
    const dia = '08'
    const mes = '11'
    const urlPesquisa = `https://www.lexology.com/?d=$(ano)-$(mes)-$(dia)`
    var browser = await puppeteer.launch({
        headless: true
    });
    var page = await browser.newPage();
    page.setDefaultTimeout(0);
    page.setViewport({width:1200, height:772, deviceScaleFactor:1});

    await page.goto('https://www.lexology.com/');
    await delay(2000)

    await aceitandoTermo();

    await loginEsenha('biblioteca@machadomeyer.com.br', 'Mmso1052');
    
    await delay(2000);

    await navigation();
    
    const listaDeArtigos = await pesquisaArtigos(page);

    const listaDeDados = await pesquisaProfundaDosLinks(listaDeArtigos, "");

    await saveToCSV(listaDeDados);

    await logout();

    await browser.close();

    helpers.setupMomentBR()
    moment().locale("pt_BR");

    
    async function aceitandoTermo(){
        try{
            const ButtonCookies = '#onetrust-accept-btn-handler';
            console.log('Esperando Termo');
            await page.waitForSelector(ButtonCookies,{
                timeout:(60*2)*1000 //até 2 min
            });
            await console.log('Indo clicar no termo');
            await page.click(ButtonCookies, {clickCount: 1,});
        }catch (error) {
            console.log(error);
            browser.close();
        }
    }


    async function loginEsenha(email, senha){
        try{
            const EmailInput = '#EmailAddress';
            const SenhaInput = '#Password';
            const ButtonSubmit = '#Invalid > div.pull-left > form > p > input[type=submit]:nth-child(11)';

            await page.goto('https://www.lexology.com/account/login?returnurl=/');

            await page.waitForSelector(EmailInput);
            console.log('Digitando email');
            await page.type(EmailInput, email, {delay: 100});

            await page.waitForSelector(SenhaInput);
            console.log('Digitando senha');
            await page.type(SenhaInput, senha, {delay: 100});

            console.log('Fazendo login');
            await page.click(ButtonSubmit, {clickCount: 1,});
            
        }catch(error){
            console.log(error)
            browser.close
        }
    }

    async function navigation(){
        try{
            const ResourcesButton = '#resources-nav-link'
            const ExploreButton = 'https://www.lexology.com/search?ct=0&utm_content=resourcenav'

            await page.waitForSelector(ResourcesButton)
            await page.click(ResourcesButton, {clickCount: 1});

            delay(1500);

            await page.goto(ExploreButton);
        }catch(error){
            console.log(Error)
            //browser.close;
        }
    }

    

    async function pesquisaArtigos(page){
        try{ 
            let doPage = async (page) =>
                new Promise(async(resolve, reject) => {
                    const articles = 'div.results > div.adv-searchresult'
                    await page.waitForSelector(articles, {
                        timeout: 120*1000 //até 2min
                    });
                    console.log("Contando...");
                    const countItems = await page.$$eval(
                        articles,
                        (ResultNumber) => ResultNumber.length
                    );
                    console.log(countItems)
                    if (countItems === 0){
                        return console.log('Nenhum resultado encontrado');
                    }
                    const itens = await page.evaluate(() => {
                        const articles = 'div.results > div.adv-searchresult'
                        console.log('Selecionando itens');
                        let items = Array.from(document.querySelectorAll(articles));
                        console.log(items);
                        console.log('Ordenando');
                        return items.map( item => {
                            const titulo = item.querySelector('h3 a').innerText;
                            const link = item.querySelector('h3 a').href;
                            const ementa = item.querySelector('div.search-precis').innerText;
                            return{
                                titulo,
                                link,
                                ementa,
                            }
                        })
                    }); 
                    resolve(itens)
                });
            console.log('Chamando doPage')
            const items = await doPage(page)
            console.log(items)
            return items
        }catch (error) {
        reject(error);
        //browser.close();
        }
        
    }

    async function pesquisaProfundaDosLinks(listaDeArtigos, SearchKey){
        try{
            console.log("Ordenando dados em um array")
            const listaDeDados = []
            for(let index in listaDeArtigos) {
                const row = listaDeArtigos[index]
                const clippingDate = moment(new Date())
                await toPDF(row)
                const data = await deepSearch(row)
                listaDeDados.push({
                    titulo: row.titulo,
                    ementa: row.ementa,
                    id: getUuid(row.link),
                    link: row.link,
                    integra: data.integra,
                    palavra_chave: SearchKey,
                    data_cadastro: clippingDate.format('YYYYMMDD HH:mm'),
                    data_clipping: clippingDate.format('YYYYMMDD'),
                    data_publicacao: data.dataPublicacao,
                    fonte: '',
                    link_relacionado: '',
                })
            }
            console.log(listaDeDados)
            return listaDeDados
        }catch (error) {
            console.log(error)
        }
    }

    async function deepSearch(row){
        try{
            return new Promise(async(resolve)=>{
                const selecaoIntegra = 'div.article-body'
                console.log(`Acessando conteúdo da página ${row.link}`)
                page.goto(row.link)
                console.log(`Pegando dados`)
                await delay(200)
                await page.waitForSelector(selecaoIntegra);
                const result = await page.evaluate(() => {
                    function tryIntegra(){
                        try{
                            const selecaoIntegra = 'div.article-body'
                             const integra = document.querySelector(selecaoIntegra).innerText.replace(/\s+/gi, ' ')
                             return integra
                         }catch(e){
                             return ''
                         }
                     }
                    
                     function tryData(){
                        try{
                            const selecaoData = '#article-attributes > span.publication'
                             const data = document.querySelector(selecaoData).innerText
                             return data
                         }catch(e){
                             return ''
                         }
                     }

                    console.log("Pegando integra")
                    const integra = tryIntegra();
                    const dataPublicacao = tryData();
                    console.log("Pegando Data de publicação")
                    return {
                        integra,
                        dataPublicacao,
                    }
                })
                resolve(result)
            })
        }catch (error) {
        //reject(error);
        browser.close();
        }
    }

    async function saveToCSV(items) {
        const path = `X30${'iloaviation'}/${moment().format("YYYY/MM/DD")}/csv`
        await makeDirectory(`${path}`);
        const filename = `${path}/${helpers.slugify('10recentes')}`;
        return toCSV(
            items.map((row) => {
                row.titulo = helpers.stripTags(row.titulo);
                row.integra = String(row.integra).replace(/\s+/gi, " ");
                return row;
            }),
            filename
        );
    }
    async function toPDF(row) {
        return new Promise(async(resolve) => {
            // const browser = await puppeteer.launch(helpers.puppeterOptionsLaunch());
            try {
                const path = `X30${'iloaviation'}/${moment().format("YYYY/MM/DD")}/pdf`
                await makeDirectory(`${path}`);
                const filename = `${path}/${getUuid(row.link)}.pdf`;
                console.info(`✔ pdf ${filename}`);
                await page.pdf({ path: filename, format: "A4" });
                resolve(true);
            } catch (error) {
                console.log(error);
                browser.close();
            }
        });
    }

    async function logout(){
        try{
            const submenu ='#mylex-nav > div > a'
            const logout = '#mylex-sub-nav > ul > li:nth-child(5) > a'

            await page.waitForSelector(submenu)
            console.log('Fazendo logout');
            await page.click(submenu, {clickCount: 1})

            await page.waitForSelector(logout, {
                timeout:120*1000
            });
            await page.click(logout, {clickCount: 1});
            
            await delay(500);
            await page.waitForNavigation();

        }catch(error){
            console.log(Error);
            browser.close();
        }
    }


})()