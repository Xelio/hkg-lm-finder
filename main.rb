require 'sinatra'
require 'oboe-heroku'
require 'oboe'
require 'open-uri'
require 'addressable/uri'
require 'logger'
require 'excon'

configure :development do
  set :bind, '0.0.0.0' 
  set :port, 3000 # Not really needed, but works well with the "Preview" menu option
end

configure do
  $logger = Logger.new(STDERR)
end

error 404 do
  "You should not be there!"
end

get '/' do
  "Proxy is running."
end

get %r{/proxy/(.+)} do |url|
  page_params = params
  page_params.delete('splat')
  page_params.delete('captures')
  
  request_url = 'http://' + url+(page_params.empty? ? '' : '?'+URI.encode_www_form(page_params))

  uri = get_uri(request_url)
  
  stream do |out|
    if defined? Oboe::API
      stream_request_with_oboe(uri, request, out)
    else
      stream_request(uri, request, out)
    end
  end
end

def get_uri(url)
  uri = nil
  begin
    uri = Addressable::URI.parse(url)
  rescue
    halt 404
  end
  
  # Only for hkgolden profile page
  halt 404 if uri.host.nil? || uri.host.index(/^[^\.]+\.hkgolden\.com/).nil?
  halt 404 if uri.path.nil? || uri.path.index(/^\/ProfilePage/).nil?
  
  # $logger.debug(uri.to_s)
  uri
end

def stream_request_with_oboe(uri, request, out_stream)
  layer_name = 'stream'
  report_kvs = {}
  report_kvs['HTTP-Host'] = uri.host
  report_kvs[:URL] = uri.path

  Oboe::API.start_trace(layer_name, request['X-Trace'], report_kvs) do
    stream_request(uri, request, out_stream)
  end
end

def stream_request(uri, request, out_stream)
  begin
    headers = { "Content-Type" => request.content_type, 
                              "User-Agent"=>request.user_agent}
    
    streamer = lambda do |chunk, remaining_bytes, total_bytes|
      # $logger.debug(chunk);
      out_stream << chunk
    end
    
    Excon.get(uri, :omit_default_port => true, 
                                :headers => headers, 
                                :response_block => streamer)
  rescue  => e
    $logger.error(e)
  end
end