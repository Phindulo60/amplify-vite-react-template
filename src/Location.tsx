import { useMap } from "react-leaflet";
import { useContext, useState, useEffect } from "react";
import "leaflet-contextmenu/dist/leaflet.contextmenu.css";
import { gqlClient, graphqlOperation } from "./App";
import { updateLocation } from "./graphql/mutations";
import { UserContext } from "./UserContext";
import { ImageContext } from "./BaseImage";
import L from "leaflet";
import "leaflet-contextmenu";

interface LocationProps {
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
  isTest: number | null;
  showTestCase?: boolean;
  confidence?: number;
}

export default function Location({
  x,
  y,
  width,
  height,
  id,
  isTest: _isTest,
  showTestCase = true,
  confidence = 0,
}: LocationProps) {
  const { xy2latLng } = useContext(ImageContext)!;
  const [isTest, setTest] = useState<number | null>(_isTest);
  const { user } = useContext(UserContext)!;
  const [key, setKey] = useState<string>(crypto.randomUUID());

  const boundsxy: [number, number][] = [
    [x - width / 2, y - height / 2],
    [x + width / 2, y + height / 2],
  ];

  const map = useMap();
  
  const contextMenuItems = [
    {
      text: `Confidence : ${confidence}`,
      callback: () => console.log("conf callback"),
    },
  ];

  if (user?.isAdmin) {
    contextMenuItems.push({
      text: isTest
        ? "Stop using this location as a test location"
        : "Use this location as a test location",
      callback: changeTest,
    });
  }

  function changeTest() {
    setKey(crypto.randomUUID());
    setTest(isTest ? null : Math.floor(Date.now() / 1000));
    gqlClient.graphql(
      graphqlOperation(updateLocation, {
        input: { id, isTest: isTest ? null : Math.floor(Date.now() / 1000) },
      })
    );
  }

  useEffect(() => {
    const latLngBounds = xy2latLng(boundsxy) as unknown as L.LatLngBoundsLiteral;
    const rectangle = L.rectangle(latLngBounds, {
      color: showTestCase && isTest ? "red" : "blue",
      fill: false,
    }).addTo(map);

    (rectangle as any).bindContextMenu({
      contextmenu: true,
      contextmenuInheritItems: false,
      contextMenuItems,
    });

    return () => {
      map.removeLayer(rectangle);
    };
  }, [map, key, boundsxy, contextMenuItems]);

  return null;
}
