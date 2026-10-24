# 日本測速點　Japan Speed Cameras

開車接近日本測速照相時警示，並可先列出路線沿途的測速，再交給 Google 地圖導航。也可搜尋全國位置，匯出到 Google 我的地圖。不是警察官方清單。  
Warns as you approach a speed camera in Japan, lists cameras along a driving route, then hands turn-by-turn directions to Google Maps. You can also search the nationwide points and export them to Google My Maps. This is not an official police list.

資料時間 Data as of：2026-10　·　目前 2,666 筆、47 個都道府縣　2,666 points across all 47 prefectures

## 關於　About

<table>
<tr>
<th width="50%">中文</th>
<th width="50%">English</th>
</tr>
<tr>
<td valign="top">

這個工具有兩件事。開車時，首頁會依你的位置，在接近測速點時發出提示音和語音。輸入目的地後，會列出開車路線兩旁大約 350 公尺內的測速；轉彎導航交給 Google 地圖。另一頁用來查公開位置，並把選到的點做成 KML 或 CSV，匯入 [Google 我的地圖](https://www.google.com/maps/d/)。

資料有三層：

- **指南地圖（約 2,460）**：取自オービスガイド公開地圖上的圖示針尖。包含橘色、藍色、綠色水滴圖示。大約位置，誤差大約一兩百公尺。圖上沒有標固定式、半固定式或移動式。
- **地圖標註（199）**：OpenStreetMap 上的測速照相節點，是地圖實測點，不是官方清單。
- **四國已整理的少數點**：固定式 2、半固定式 3、移動目擊 2。這些有較完整的備註，和指南地圖重複的點不會再畫一次。

有些縣筆數很少，例如高知、宮崎、鹿兒島。那是公開地圖上本來就少，不是漏掉整縣。

速限數字是路段標示，不是相機拍攝的門檻。請遵守速限。

</td>
<td valign="top">

This tool does two things. While you drive, the first page beeps and speaks as you approach a camera. Enter a destination and it lists cameras within about 350 metres of the driving line; turn-by-turn navigation stays in Google Maps. The other page looks up the public points and turns the ones you choose into KML or CSV for [Google My Maps](https://www.google.com/maps/d/).

There are three layers:

- **Guide map (about 2,460).** Pin tips from the public オービスガイド map, including orange, blue, and green teardrops. These are approximate, often off by 100–200 metres. The map does not say whether a pin is fixed, semi-fixed, or mobile.
- **Map nodes (199).** OpenStreetMap `speed_camera` nodes. They are mapped points, not an official list.
- **A few curated Shikoku points.** 2 fixed, 3 semi-fixed, and 2 mobile sightings, kept because the notes are more specific. Guide pins within about 250 metres of these are not duplicated.

Some prefectures have very few points, such as Kochi, Miyazaki, and Kagoshima. The public map itself is sparse there. Those prefectures were not skipped.

A speed number is the posted limit on the nearby road, not the speed that triggers a photo. Obey the limit.

</td>
</tr>
</table>

## 下載後怎麼執行　Run it after you download the source

沒有可直接點兩下的程式。下載的是網站原始碼，要先裝 Node.js，再在解壓縮後的資料夾啟動。啟動後用瀏覽器開，不要關掉那個黑色視窗。

There is no double-click program. The download is the website source. Install Node.js, start it in the unzipped folder, then open a browser. Leave the terminal window open.

<table>
<tr>
<th width="50%">中文</th>
<th width="50%">English</th>
</tr>
<tr>
<td valign="top">

**要先裝一次**

1. 打開 [Node.js 官網](https://nodejs.org/)，下載並安裝 **22** 版（寫著 22 的 LTS 即可）。
2. 安裝時若看到 “Add to PATH”，請保持勾選。
3. 安裝完成後，新開一個「命令提示字元」或 PowerShell，輸入 `node -v` 後按 Enter。應出現 `v22` 開頭的版本。若出現「不是內部或外部命令」，關掉視窗再試一次；還是不行就重開電腦。

**下載整包**

4. 打開這個 GitHub 頁面，按綠色 **Code**，選 **Download ZIP**。
5. 壓縮檔多半在「下載」資料夾，檔名類似 `brave-coral-earth-onyx-main.zip`。
6. 對壓縮檔按右鍵，選「解壓縮全部」。解完後要看得到 **`package.json`** 和 `src` 資料夾。若只看到另一層資料夾，再點進去，直到 `package.json` 就在眼前。

**啟動**

7. 在看得到 `package.json` 的那個資料夾裡，點上面的網址列，輸入 `cmd`，按 Enter。會開一個黑窗，而且已經在正確的資料夾。
8. 輸入下面這行，按 Enter，等它跑完（第一次可能要數分鐘，需要網路）：

```
npm install
```

9. 完成後再輸入，按 Enter：

```
npm run dev
```

10. 黑窗出現 `Local:` 以及 `http://localhost:8080/` 後，用 Chrome 或 Edge 打開：

[http://localhost:8080/](http://localhost:8080/)

應看到「行車警示」。另一個分頁是「地圖搜尋」。地圖底圖也要網路才載入得出來。規劃沿途測速時也要網路；已經定位之後，附近警示可以離線比對。

**使用時**

- 黑窗要一直開著。關掉它，網頁就停了。
- 要結束時，在黑窗按 `Ctrl + C`，若問是否終止，輸入 `Y` 再按 Enter。
- 下次不用重裝 Node，也不必再 `npm install`（除非資料夾換了）。進同一個資料夾，再執行一次 `npm run dev`，然後開同一個網址。
- 不要自己做 `.env`，也不要設定 `DATABASE_URL`。這個搜尋頁不需要資料庫帳號。

**常見打不開**

- `npm` 不是內部或外部命令：Node 沒進 PATH。重開命令提示字元，或重裝 Node.js 22。
- `npm install` 說找不到 `package.json`：視窗不在解壓縮後的那一層。用第 7 步的方式再開一次。
- 網址打不開，或寫 port 8080 already in use：上次的黑窗還開著。找到它按 `Ctrl + C`，或重開機後再執行 `npm run dev`。
- 頁面有了但地圖是灰的：電腦沒有網路，或防火牆擋住地圖圖磚。清單仍可搜尋。

</td>
<td valign="top">

**Install this once**

1. Download and install **Node.js 22** from [nodejs.org](https://nodejs.org/) (the LTS build whose version starts with 22).
2. If the installer offers “Add to PATH”, leave it checked.
3. Open a new Command Prompt or PowerShell and run `node -v`. You should see a version starting with `v22`. If the command is not recognized, close the window and try again, then restart the computer.

**Download the whole package**

4. On this GitHub page, click the green **Code** button and choose **Download ZIP**.
5. The file is usually in Downloads, named like `brave-coral-earth-onyx-main.zip`.
6. Right-click it and choose Extract All. After extracting, you must see **`package.json`** and a `src` folder. If you only see another folder, open that folder until `package.json` is right there.

**Start it**

7. Open the folder that contains `package.json`. Click the address bar, type `cmd`, and press Enter. A terminal opens already in that folder.
8. Run this and wait until it finishes (the first time can take several minutes, and it needs the internet):

```
npm install
```

9. Then run:

```
npm run dev
```

10. When the terminal shows `Local:` and `http://localhost:8080/`, open Chrome or Edge at:

[http://localhost:8080/](http://localhost:8080/)

You should see the driving alert. The other tab is the map search. The map tiles also need a network connection. Planning cameras along a route also needs the network. Once you have a location, nearby alerts can be matched offline.

**While you use it**

- Leave the terminal open. Closing it stops the site.
- To stop, press `Ctrl + C` in that window. If it asks for confirmation, press `Y` and Enter.
- Next time you do not reinstall Node, and you do not run `npm install` again unless you extracted a new copy. Open the same folder, run `npm run dev`, and open the same address.
- Do not create a `.env` file and do not set `DATABASE_URL`. The search page does not need a database login.

**If it does not open**

- `npm` is not recognized: Node is not on PATH. Open a new terminal, or reinstall Node.js 22.
- `npm install` cannot find `package.json`: the terminal is in the wrong folder. Repeat step 7.
- The address fails, or the terminal says port 8080 is already in use: an older terminal is still running. Press `Ctrl + C` there, or restart the computer and run `npm run dev` again.
- The page loads but the map is gray: the computer is offline, or a firewall is blocking map tiles. Search in the list still works.

</td>
</tr>
</table>

## 行車警示與導航　Driving alert and navigation

<table>
<tr>
<th width="50%">中文</th>
<th width="50%">English</th>
</tr>
<tr>
<td valign="top">

1. 打開首頁「行車警示」，按「開始定位」，允許瀏覽器使用位置。人要在日本，附近才會對到這些點。
2. 接近時會響，並顯示距離。可改警示距離、只報前方、語音和提示音。
3. 在「導航」輸入目的地，例如「高松站」，按「列出沿途測速」。清單是路線兩旁約 350 公尺內的點，由近到遠。
4. 按「用 Google 地圖導航」會打開 Google 地圖的開車導航。這個網站不負責轉彎指示。
5. 要一邊看地圖一邊聽警示：在 Chrome 按「浮在 Google 地圖上」。若浮窗失敗，用手機多工鍵把這個畫面放上面、地圖放下面。
6. 沒有定位時可按「試跑警示」，聽一段接近測速點的示範，那不是你的位置。
7. 關掉這個分頁或瀏覽器，警示就停了。它不能裝成一直在背景響的手機 App。

路線是公開路網算出來的參考線，不是 Google 的導航路徑，也可能和你實際走的交流道不同。沿途清單同樣不是官方相機位置。

</td>
<td valign="top">

1. Open the Driving alert page and tap Start location. Allow the browser to use your position. You need to be in Japan for these points to match the road around you.
2. It beeps and shows the distance as you approach. You can change the warning distance, ahead-only, voice, and tones.
3. Under Navigation, enter a destination such as Takamatsu Station and tap List cameras along the route. The list is points within about 350 metres of the driving line.
4. Use Google Maps to navigate opens Google Maps driving navigation. This site does not give turn-by-turn instructions.
5. To keep the alert visible beside the map, tap Float above Google Maps in Chrome. If the float window is not available, use the phone’s split screen: this page on top, Maps below.
6. Without a location, Demo plays one approach. That is not your position.
7. Closing the tab or the browser stops the alert. This is not a phone app that keeps warning in the background.

The line is a reference route from the public road network, not Google’s path, and it may not match the interchange you actually take. Cameras along it are not an official list either.

</td>
</tr>
</table>

## 地圖搜尋與匯出　Search and export

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
