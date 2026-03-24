// import MapView, { Marker } from "react-native-maps";
// import { View, TextInput, Button } from "react-native";
// import { useState } from "react";

// export default function MapScreen() {

//   const [start, setStart] = useState("");
//   const [end, setEnd] = useState("");

//   return (

//     <View style={{ flex: 1 }}>

//       <View style={{ padding: 10 }}>

//         <TextInput
//           placeholder="Start Location"
//           value={start}
//           onChangeText={setStart}
//           style={{
//             borderWidth: 1,
//             marginBottom: 10,
//             padding: 10,
//             borderRadius: 5,
//           }}
//         />

//         <TextInput
//           placeholder="Destination"
//           value={end}
//           onChangeText={setEnd}
//           style={{
//             borderWidth: 1,
//             marginBottom: 10,
//             padding: 10,
//             borderRadius: 5,
//           }}
//         />

//         <Button title="Find Route" onPress={() => {}} />

//       </View>

//       <MapView
//         style={{ flex: 1 }}
//         initialRegion={{
//           latitude: 7.8731,
//           longitude: 80.7718,
//           latitudeDelta: 5,
//           longitudeDelta: 5,
//         }}
//       >
//         <Marker
//           coordinate={{ latitude: 6.9271, longitude: 79.8612 }}
//           title="Colombo"
//         />

//       </MapView>

//     </View>
//   );
// }