const CRC = require('modbuscrc');
const crc = require('node-crc16');

function test(comando) {

    console.log('comando', comando);
    let aux = []
    const e = comando;

    // La Dirección del Dispositivo
    aux.push(1)

    // El número de la función
    aux.push(e.funcion)

    for (let d = 0; d < e.direccion.length; d++) {
        const element = e.direccion[d];
        console.log('element', element);
        aux.push(element)
    }

    for (let l = 0; l < e.largo.length; l++) {
        const element = e.largo[l];
        aux.push(element)
    }

    let crc2 = calculaCRC2(aux)
    console.log('crc2', crc2);

    // let crc = calculaCRC(aux)
    // console.log('crc', crc);


    // aux.push(crc[0])
    // aux.push(crc[1])


    console.log(aux);


}

function calculaCRC(_crc16) {
    const crc16 = CRC(Buffer.from(_crc16));
    let _aux = crc16.split(/(?=(?:..)*$)/)
    let salida = []
    _aux.forEach(e => {
        salida.push(parseInt(e, 16));
    });
    return salida;
}

function calculaCRC2(_crc16) {
    const crc16 = crc.checkSum(Buffer.from(_crc16), { retType: 'array' });
    return crc16;
}

let comando = {
    "id": 12,
    "funcion": 3,
    "campo": "ReseteableImportActiveEnergy",
    "nombre": "ReseteableImportActiveEnergy",
    "direccion": [
        1,
        132
    ],
    "largo": [
        0,
        4
    ]
}

let comando2 = {
    "id": 1,
    "funcion": 4,
    "campo": "V1",
    "nombre": "Voltaje #1",
    "direccion": [
        0,
        0
    ],
    "largo": [
        0,
        4
    ]
}

test(comando)