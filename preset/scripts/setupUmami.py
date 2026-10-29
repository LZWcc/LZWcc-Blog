from pathlib import Path
import json,secrets,urllib.request,urllib.error
base='http://127.0.0.1:3100/api'
folder=Path('/opt/umami-blog')
credentials_path=folder/'admin-credentials.json'
if credentials_path.exists():
 credentials=json.loads(credentials_path.read_text())
else:
 credentials={'username':'admin','password':secrets.token_urlsafe(30)}
 credentials_path.write_text(json.dumps(credentials,indent=2)+'\n');credentials_path.chmod(0o600)
def request(path,method='GET',body=None,token=None):
 headers={'Content-Type':'application/json'}
 if token: headers['Authorization']='Bearer '+token
 req=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
 with urllib.request.urlopen(req,timeout=30) as response:return json.load(response)
try:
 login=request('/auth/login','POST',{'username':credentials['username'],'password':credentials['password']})
except urllib.error.HTTPError as error:
 if error.code!=401: raise
 login=request('/auth/login','POST',{'username':'admin','password':'umami'})
 request('/me/password','POST',{'currentPassword':'umami','newPassword':credentials['password']},login['token'])
 login=request('/auth/login','POST',{'username':credentials['username'],'password':credentials['password']})
token=login['token']
website_id='9b363da4-6bef-44cd-b4ac-1d88a0bdc31b'
website=None
try: website=request('/websites/'+website_id,token=token)
except urllib.error.HTTPError as error:
 if error.code not in (401,404): raise
if not website:
 request('/websites','POST',{'id':website_id,'name':'LZWcc','domain':'lzwcc.xyz'},token)
key_path=folder/'stats-api-key'
if not key_path.exists():
 api_key=request('/me/api-keys','POST',{'name':'Blog pageview sync'},token)['key']
 key_path.write_text(api_key+'\n');key_path.chmod(0o600)
else:api_key=key_path.read_text().strip()
request('/websites/'+website_id,token=api_key)
env_folder=Path('/etc/lzwcc-blog');env_folder.mkdir(mode=0o700,exist_ok=True)
env_path=env_folder/'umami.env'
env_path.write_text('UMAMI_API_KEY='+api_key+'\nPUBLIC_UMAMI_WEBSITE_ID='+website_id+'\nUMAMI_API_CLIENT_ENDPOINT=http://127.0.0.1:3100/api\nUMAMI_STATS_START_AT=2026-04-01\n')
env_path.chmod(0o600)
print('Admin password changed; website and private sync API key configured.')
