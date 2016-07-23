Twitter メディアダウンローダ (twMediaDownloader)
================================================

- License: The MIT license  
- Copyright (c) 2016 風柳(furyu)  
- 対象ブラウザ： Google Chrome、Firefox

[Web 版公式 Twitter](https://twitter.com/) の、ユーザーのメディアタイムライン上の画像を、原寸サイズでまとめてダウンロードするためのスクリプト。  


■ インストール方法 
---
### ユーザースクリプト版（Greasemonkey / Tampermonkey）
Firefox＋[Greasemonkey](https://addons.mozilla.org/ja/firefox/addon/greasemonkey/)、Google Chrome＋[Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo?hl=ja) の環境で、  

> [Twitter メディアダウンローダ (twMediaDownloader.user.js)](https://github.com/furyutei/twMediaDownloader/raw/master/src/js/twMediaDownloader.user.js)  
                                
をクリックし、指示に従ってインストール。  


■ 使い方
---
[Web 版公式 Twitter](https://twitter.com/) 上で、ユーザータイムラインを開くと、「メディア」の右に下向き矢印のリンクが挿入される。  
![下向き矢印のリンク](https://cdn-ak.f.st-hatena.com/images/fotolife/f/furyu-tei/20160723/20160723224518.jpg)  

これをクリックするとダイアログが表示されるので、[開始]ボタンをクリックすると、原寸画像の ZIP 化が開始される。  
※ ZIP 化の進捗は、下部にログ出力される。  
![ダイアログ](https://cdn-ak.f.st-hatena.com/images/fotolife/f/furyu-tei/20160723/20160723224527.jpg)  

ZIP 化が完了するか、もしくは[停止]を押すと、対象となる画像ファイルをまとめた ZIP ファイルがダウンロードされる。  
※ ログの内容も ZIP の中に保存される。

必要に応じて、保存対象となるツイートの Tweet ID 範囲、および、ツイートの制限数を指定可能。  
※デフォルト(範囲空白)の状態では、Tweet ID 範囲は全てで、ツイートの制限数にのみ制限される。  


■ 外部ライブラリなど
---
- [jQuery](https://jquery.com/)  
- [JSZip](https://stuk.github.io/jszip/)  


■ 関連記事
---
- [Twitter メディアダウンローダ：ユーザータイムラインの原寸画像をまとめてダウンロードするユーザースクリプト(PC用Google Chrome・Firefox等対応) - 風柳メモ](http://furyu.hatenablog.com/entry/20160723/1469282864)
- [Twitter 原寸びゅー：Twitterの原寸画像を開くGoogle Chrome拡張機能＆ユーザースクリプト公開 - 風柳メモ](http://furyu.hatenablog.com/entry/20160116/1452871567)  
