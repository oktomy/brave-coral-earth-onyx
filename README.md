# 日本測速點　Japan Speed Cameras

搜尋日本全國測速照相位置，並匯出到 Google 我的地圖。不是警察官方清單。  
Search speed-camera locations across Japan and export them to Google My Maps. This is not an official police list.

資料時間 Data as of：2026-10　·　目前 2,666 筆、47 個都道府縣　2,666 points across all 47 prefectures

## 關於　About

<table>
<tr>
<th width="50%">中文</th>
<th width="50%">English</th>
</tr>
<tr>
<td valign="top">

這個工具用來查日本測速照相的公開位置，並把選到的點做成 KML 或 CSV，匯入 [Google 我的地圖](https://www.google.com/maps/d/)。

資料有三層：

- **指南地圖（約 2,460）**：取自オービスガイド公開地圖上的圖示針尖。包含橘色、藍色、綠色水滴圖示。大約位置，誤差大約一兩百公尺。圖上沒有標固定式、半固定式或移動式。
- **地圖標註（199）**：OpenStreetMap 上的測速照相節點，是地圖實測點，不是官方清單。
- **四國已整理的少數點**：固定式 2、半固定式 3、移動目擊 2。這些有較完整的備註，和指南地圖重複的點不會再畫一次。

有些縣筆數很少，例如高知、宮崎、鹿兒島。那是公開地圖上本來就少，不是漏掉整縣。

速限數字是路段標示，不是相機拍攝的門檻。請遵守速限。

</td>
<td valign="top">

This tool looks up publicly reported speed-camera locations in Japan and turns the points you choose into KML or CSV for [Google My Maps](https://www.google.com/maps/d/).

There are three layers:

- **Guide map (about 2,460).** Pin tips from the public オービスガイド map, including orange, blue, and green teardrops. These are approximate, often off by 100–200 metres. The map does not say whether a pin is fixed, semi-fixed, or mobile.
- **Map nodes (199).** OpenStreetMap `speed_camera` nodes. They are mapped points, not an official list.
- **A few curated Shikoku points.** 2 fixed, 3 semi-fixed, and 2 mobile sightings, kept because the notes are more specific. Guide pins within about 250 metres of these are not duplicated.

Some prefectures have very few points, such as Kochi, Miyazaki, and Kagoshima. The public map itself is sparse there. Those prefectures were not skipped.

A speed number is the posted limit on the nearby road, not the speed that triggers a photo. Obey the limit.

</td>
</tr>
</table>

## 使用說明　How to use

<table>
<tr>
<th width="50%">中文</th>
<th width="50%">English</th>
</tr>
<tr>
<td valign="top">

1. 在搜尋框輸入道路或市町村，例如「中央自動車道」「札幌」「那霸」。
2. 先選地區：全國、北海道、東北、關東、中部、近畿、中國、四國、九州・沖繩。
3. 選「全國」時，用下拉選單一都道府縣。選了某個地區後，可以再點該地區的縣。
4. 用類型縮小範圍：全部類型、固定式、半固定、地圖標註、移動目擊、指南地圖。
5. 「依我的位置」會依瀏覽器定位，由近到遠排序。
6. 點清單或地圖上的點，可看說明、在 Google 地圖打開，或複製座標。
7. 勾選要匯出的點。沒有勾選時，匯出的是目前篩選結果。清單很長時先顯示一部分，可按「繼續顯示」。
8. 按「下載 KML」或「下載 CSV」。檔名是 `japan-speed-cameras.kml` 或 `.csv`。
9. 在電腦上，檔案會進瀏覽器的「下載」資料夾，不是桌面。預設通常不會跳出「另存新檔」。
10. 若預覽裡「下載」資料夾是空的，按「複製 KML」，貼到記事本，另存新檔。存檔類型選「所有檔案」，副檔名用 `.kml` 或 `.csv`。
11. 在手機上，若跳出分享，選「儲存到檔案」或雲端硬碟。
12. 打開 [Google 我的地圖](https://www.google.com/maps/d/)，建立地圖，選「匯入」，上傳剛才的檔案。

</td>
<td valign="top">

1. Search by road or municipality, for example Chuo Expressway, Sapporo, or Naha.
2. Pick a region: All Japan, Hokkaido, Tohoku, Kanto, Chubu, Kinki, Chugoku, Shikoku, or Kyushu and Okinawa.
3. On All Japan, use the prefecture menu. After you pick a region, you can narrow it to one prefecture.
4. Filter by type: all, fixed, semi-fixed, map node, mobile sighting, or guide map.
5. “Near me” asks the browser for your location and sorts the list by distance.
6. Select a row or a map dot to read the note, open it in Google Maps, or copy the coordinates.
7. Tick the points to export. If none are ticked, the export is the current filter. Long lists show a page at a time; use “show more”.
8. Choose Download KML or Download CSV. The file name is `japan-speed-cameras.kml` or `.csv`.
9. On a computer, the browser saves it in Downloads, not on the desktop. It usually does not open a Save As dialog.
10. If the preview’s Downloads folder stays empty, use Copy KML, paste into a text editor, and save. Set the file type to All files and use the `.kml` or `.csv` extension.
11. On a phone, a share sheet may appear. Choose Save to Files or a cloud drive.
12. Open [Google My Maps](https://www.google.com/maps/d/), create a map, choose Import, and upload the file.

</td>
</tr>
</table>

## 請先知道　Before you rely on it

<table>
<tr>
<th width="50%">中文</th>
<th width="50%">English</th>
</tr>
<tr>
<td valign="top">

不是警察或道路管理單位的官方清單。相機可能新設、撤除或調動，尤其是移動式，不會留在原地。出發前仍要看現場標誌。

指南地圖的圖太大，一個圖示在緯度 35 度附近大約是六十公尺一個像素，針尖對不準柱位。請把它當「這一段附近」，不要當成車道上的精確點。

</td>
<td valign="top">

This is not a list from the police or the road authority. Cameras are added, removed, and moved. Mobile cameras do not stay where they were seen. Check the signs on the road.

The guide map is coarse. Near latitude 35, one pixel is about 60 metres, so the pin tip is not the camera post. Treat it as “somewhere along this stretch,” not an exact lane position.

</td>
</tr>
</table>
