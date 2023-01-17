/**
 * --------------------------------------------------------
 * Este programa crea una conexión Serial vía ttyUSB? y envía comandos
 * al medidor.
 * Los comandos se obtienen desde al arcivo JSON.
 * Cuando completa la secuencia de comandos, los envía a la API con Axios
 * --------------------------------------------------------
 */

const CRC = require('modbuscrc');
const axios = require('axios')
const SerialPort = require('serialport')
const port = new SerialPort('/dev/ttyUSB0', {
    baudRate: 9600
})

let comandoConsultado = 0
let salida = {}

let comandos = require('./comandosLovato.json')

/**
 * Cantidad de dispositivos que se conectarán
 * Si la cantidad es 3, entonces los ID de cada
 * dispositivo serán 1, 2 y 3
 */
const cantDispositivos = 3

async function init() {

    salida = {}

    for (let j = 1; j <= cantDispositivos; j++) {

        
        for (let i = 0; i < comandos.length; i++) {
            const e = comandos[i];
            let aux = []

            comandoConsultado = e.id

            // La Dirección del Dispositivo
            aux.push(j)

            // El número de la función
            aux.push(e.funcion)

            for (let d = 0; d < e.direccion.length; d++) {
                const element = e.direccion[d];
                aux.push(element)
            }

            for (let l = 0; l < e.largo.length; l++) {
                const element = e.largo[l];
                aux.push(element)
            }

            //console.log('aux: ', aux);
            let _cs = CRC(Buffer.from(aux))
            //console.log('_cs', _cs);
            let cs = _cs.split(/(?=(?:..)*$)/)

            cs.forEach(e => {
                aux.push(parseInt(e, 16));
            });

            enviaRequest(aux);
            await sleep(2000);
        }
    }

    console.log('salida', salida);
    uploadData()
}

function uploadData() {
    salida.SerialNumber = '00060023'
    axios.post('http://186.64.121.168:2055/newdato', salida)
        .then(function (response) {
            console.log(response.data);
        })
        .catch(function (error) {
            console.log(error);
        });
}

// Envía comando al MEDIDOR
function enviaRequest(buffer) {
    port.write(buffer, function (err) {
        if (err) {
            return console.log('Error on write: ', err.message)
        }
    })

    port.on('error', function (err) {
        console.log('Error: ', err.message)
    })
}

port.on('data', function (data) {

    //Convierte buffer en array
    let arr = [...data]

    //Extrae los bytes que contienen la respuesta (5 y 6)
    let newbuffer = [arr[5], arr[6]]

    //Convierte la respuesta a un valor decimal
    let valor = Buffer.from(newbuffer).readInt16BE() //.readFloatBE();

    let index = comandos.findIndex(e => e.id == comandoConsultado)
    if (index < 0) {
        console.error('index de comando no existe');
        return;
    }
    console.log('valor 1', valor);

    let operador = comandos[index].operador
    let factor = comandos[index].factor

    if (operador == '/') {
        valor = valor / factor
    }

    if (operador == 'x') {
        valor = valor * factor
    }

    console.log('Operador es:', operador);
    console.log('Factor es:', factor);

    console.log(comandos[index].campo + ': ' + valor);
    salida[comandos[index].campo] = valor
})

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

init();




// async function init2() {
//     enviaRequest(voltaje1, 'Voltaje1')
//     await sleep(2000);
//     console.log('------------------------');
//     enviaRequest(voltaje2, 'Voltaje2')
//     await sleep(2000);
//     console.log('------------------------');
//     enviaRequest(year, 'year')
//     await sleep(2000);
//     console.log('------------------------');
//     enviaRequest(month, 'month')
//     await sleep(2000);
//     console.log('------------------------');
//     enviaRequest(totalimpactiveenergy, 'totalimpactiveenergy')
// }