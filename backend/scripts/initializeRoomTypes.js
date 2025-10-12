// scripts/initializeRoomTypes.js
// Script para inicializar tipos de habitación con precios base

const mongoose = require('mongoose');
const RoomType = require('../models/RoomType');

const roomTypesData = [
  {
    name: 'doble',
    basePrice: 15000,
    currency: 'ARS',
    capacity: 2,
    description: 'Habitación doble estándar con dos camas individuales o una matrimonial',
    amenities: ['Baño privado', 'TV', 'Wi-Fi', 'Aire acondicionado']
  },
  {
    name: 'triple',
    basePrice: 20000,
    currency: 'ARS',
    capacity: 3,
    description: 'Habitación triple con una cama matrimonial y una individual',
    amenities: ['Baño privado', 'TV', 'Wi-Fi', 'Aire acondicionado', 'Minibar']
  },
  {
    name: 'cuadruple',
    basePrice: 25000,
    currency: 'ARS',
    capacity: 4,
    description: 'Habitación cuádruple con dos camas matrimoniales',
    amenities: ['Baño privado', 'TV', 'Wi-Fi', 'Aire acondicionado', 'Minibar', 'Balcón']
  },
  {
    name: 'suite',
    basePrice: 35000,
    currency: 'ARS',
    capacity: 2,
    description: 'Suite de lujo con sala de estar separada y jacuzzi',
    amenities: ['Baño privado con jacuzzi', 'TV LED 50"', 'Wi-Fi premium', 'Aire acondicionado', 'Minibar', 'Balcón', 'Room service 24h']
  }
];

async function initializeRoomTypes() {
  try {
    console.log('🚀 Inicializando tipos de habitación...');
    
    for (const roomTypeData of roomTypesData) {
      const existingRoomType = await RoomType.findOne({ name: roomTypeData.name });
      
      if (existingRoomType) {
        console.log(`✅ Tipo '${roomTypeData.name}' ya existe, actualizando...`);
        await RoomType.findOneAndUpdate(
          { name: roomTypeData.name },
          roomTypeData,
          { new: true }
        );
      } else {
        console.log(`🆕 Creando tipo '${roomTypeData.name}'...`);
        await RoomType.create(roomTypeData);
      }
    }
    
    console.log('✅ Tipos de habitación inicializados correctamente');
    
    // Mostrar resumen
    const allRoomTypes = await RoomType.find({ isActive: true }).sort({ basePrice: 1 });
    console.log('\n📋 TIPOS DE HABITACIÓN CONFIGURADOS:');
    console.log('=====================================');
    
    allRoomTypes.forEach(roomType => {
      console.log(`${roomType.name.toUpperCase()}: ${roomType.formattedPrice}/noche (${roomType.capacity} personas)`);
      console.log(`   Descripción: ${roomType.description}`);
      console.log(`   Amenities: ${roomType.amenities.join(', ')}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error inicializando tipos de habitación:', error);
    throw error;
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  // Conectar a MongoDB si no está conectado
  if (mongoose.connection.readyState === 0) {
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/crm-hotelero';
    mongoose.connect(mongoURI)
      .then(() => {
        console.log('✅ Conectado a MongoDB');
        return initializeRoomTypes();
      })
      .then(() => {
        console.log('🎉 Inicialización completada');
        process.exit(0);
      })
      .catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
      });
  } else {
    initializeRoomTypes()
      .then(() => {
        console.log('🎉 Inicialización completada');
      })
      .catch(error => {
        console.error('❌ Error:', error);
      });
  }
}

module.exports = initializeRoomTypes;